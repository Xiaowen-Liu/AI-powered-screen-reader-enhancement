console.log("🧠 Cognitive Layer AI content script loaded");

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Create persistent ARIA live region for screen reader announcements
 */
function createPersistentLiveRegion() {
  let region = document.getElementById('cognitive-layer-announcer');
  
  if (!region) {
    region = document.createElement('div');
    region.id = 'cognitive-layer-announcer';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'assertive');
    region.setAttribute('aria-atomic', 'true');
    
    // Screen reader accessible positioning
    region.style.position = 'fixed';
    region.style.top = '0';
    region.style.left = '-10000px';
    region.style.width = '1px';
    region.style.height = '1px';
    region.style.overflow = 'hidden';
    region.style.clip = 'rect(0, 0, 0, 0)';
    region.style.whiteSpace = 'nowrap';
    
    document.body.appendChild(region);
    console.log("✅ Created persistent live region");
  }
  
  return region;
}

/**
 * Announce text to screen readers
 */
function announce(text) {
  const region = createPersistentLiveRegion();
  
  // Clear first to ensure change detection
  region.innerText = '';
  
  // Set text after delay
  setTimeout(() => {
    region.innerText = text;
    console.log(`📢 Announced: "${text}"`);
  }, 100);
  
  // Clear after announcement
  setTimeout(() => {
    region.innerText = '';
  }, 10000);
}

/**
 * Extracts main content from page
 */
function extractMainContent() {
  const main = document.querySelector("main");
  const article = document.querySelector("article");
  const contentArea = main || article || document.body;
  
  const clone = contentArea.cloneNode(true);
  clone.querySelectorAll("script, style, noscript").forEach(el => el.remove());
  
  let text = clone.innerText || "";
  return text.substring(0, 5000).trim();
}

/**
 * Gets surrounding context for an element
 */
function getElementContext(element) {
  let context = "";
  
  let parent = element.parentElement;
  let depth = 0;
  while (parent && !context && depth < 5) {
    const heading = parent.querySelector("h1, h2, h3, h4, h5, h6");
    if (heading) context = heading.innerText;
    parent = parent.parentElement;
    depth++;
  }
  
  const nearbyText = element.parentElement?.innerText || "";
  context += " " + nearbyText.substring(0, 200);
  
  return context.trim();
}

/**
 * Get content under a heading until next same-level heading
 */
function getSectionContent(heading) {
  const headingLevel = parseInt(heading.tagName[1]); // Get number from H1, H2, etc.
  let content = "";
  let currentElement = heading.nextElementSibling;
  
  // First, try to get content from sibling elements
  while (currentElement) {
    // Stop if we hit another heading of same or higher level
    if (currentElement.tagName && currentElement.tagName.match(/^H[1-6]$/)) {
      const currentLevel = parseInt(currentElement.tagName[1]);
      if (currentLevel <= headingLevel) {
        break;
      }
    }
    
    // Skip script, style, nav elements
    if (currentElement.tagName && !['SCRIPT', 'STYLE', 'NAV', 'ASIDE'].includes(currentElement.tagName)) {
      const text = currentElement.innerText || currentElement.textContent || "";
      if (text.trim()) {
        content += text + " ";
      }
    }
    
    // Limit content length
    if (content.length > 3000) {
      content = content.substring(0, 3000);
      break;
    }
    
    currentElement = currentElement.nextElementSibling;
  }
  
  // If no content found from siblings, try to find content in parent's next elements
  if (content.length < 50) {
    const parent = heading.parentElement;
    if (parent) {
      let nextSibling = parent.nextElementSibling;
      while (nextSibling && content.length < 3000) {
        // Stop if we hit another section with same or higher level heading
        const nextHeading = nextSibling.querySelector('h1, h2, h3, h4, h5, h6');
        if (nextHeading) {
          const nextLevel = parseInt(nextHeading.tagName[1]);
          if (nextLevel <= headingLevel) {
            break;
          }
        }
        
        const text = nextSibling.innerText || nextSibling.textContent || "";
        if (text.trim() && !['SCRIPT', 'STYLE', 'NAV', 'ASIDE'].includes(nextSibling.tagName)) {
          content += text + " ";
        }
        
        nextSibling = nextSibling.nextElementSibling;
      }
    }
  }
  
  // Last resort: get text from the entire parent element
  if (content.length < 50 && heading.parentElement) {
    const parentText = heading.parentElement.innerText || "";
    content = parentText.substring(0, 3000);
  }
  
  return content.trim();
}

// ============================================================
// AI OVERVIEW GENERATION
// ============================================================

async function generateOverview() {
  console.log("🔍 Generating AI Overview...");
  
  announce("Starting AI overview generation. Please wait.");
  
  try {
    // FIXED: Use window.Summarizer instead of self.Summarizer
    if (!window.Summarizer) {
      throw new Error("Summarizer API not found. Need Chrome 138+ with flags enabled.");
    }
    
    // Check availability
    const availability = await window.Summarizer.availability();
    console.log("📊 Summarizer availability:", availability);
    
    if (availability === "no") {
      throw new Error("Summarizer API is unavailable. Download model at chrome://components");
    }
    
    if (availability === "after-download") {
      announce("AI model needs to be downloaded. Starting download. This may take a few minutes.");
      console.log("⏳ Model needs download, triggering...");
    }
    
    const text = extractMainContent();
    
    if (!text || text.length < 50) {
      announce("Page content is too short to summarize.");
      console.warn("⚠️ Content too short for summary");
      return;
    }
    
    announce("Generating summary. This may take a moment.");
    
    // Create summarizer with monitor
    const summarizer = await window.Summarizer.create({
      type: "tldr",
      length: "short",
      monitor(m) {
        m.addEventListener('downloadprogress', (e) => {
          const percent = Math.round(e.loaded / e.total * 100);
          console.log(`📥 Model download: ${percent}%`);
          if (percent % 25 === 0) {
            announce(`Model downloading: ${percent} percent complete.`);
          }
        });
      }
    });
    
    // Generate summary
    const summary = await summarizer.summarize(text);
    summarizer.destroy();
    
    if (summary && summary.trim()) {
      console.log("✅ AI Overview generated:", summary);
      
      // 1️⃣ 创建一个可见 summary 区块
      const summaryBox = document.createElement("div");
      summaryBox.setAttribute("role", "status");
      summaryBox.setAttribute("aria-live", "polite");
      summaryBox.style.cssText = `
        background: #f0f6ff;
        border-left: 4px solid #1a73e8;
        padding: 12px 16px;
        margin: 16px auto;
        border-radius: 8px;
        font-family: system-ui, sans-serif;
        max-width: 800px;
        line-height: 1.5;
      `;
      summaryBox.innerHTML = `
        <h1 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600;">🧠 Page Summary</h1>
        <div>${summary}</div>
      `;
    
      // 2️⃣ 插入网页顶部（第一个元素前）
      const firstElement = document.body.firstChild;
      if (firstElement) {
        document.body.insertBefore(summaryBox, firstElement);
      } else {
        document.body.appendChild(summaryBox);
      }
    
      // 3️⃣ announce 延迟播报（保持你原逻辑）
      setTimeout(() => {
        announce(`AI Overview complete. ${summary}`);
      }, 500);
    
      console.log("📄 Summary successfully injected into page.");
    } else {
      throw new Error("Summary generation returned empty result");
    }
    
    
  } catch (error) {
    console.error("❌ Overview error:", error);
    const errorMsg = error.message || "Unknown error";
    setTimeout(() => {
      announce(`AI Overview failed. Error: ${errorMsg}`);
    }, 500);
  }
}

// ============================================================
// COGNITIVE CUES FOR HEADINGS - NOW GENERATES SECTION SUMMARIES
// ============================================================

async function generateCues() {
  console.log("🗣️ Generating Section Summaries...");
  
  announce("Starting section summaries generation. Please wait.");
  
  try {
    // Check for Summarizer API
    if (!window.Summarizer) {
      throw new Error("Summarizer API not found. Need Chrome 138+ with flags enabled.");
    }
    
    // Check availability
    const availability = await window.Summarizer.availability();
    console.log("📊 Summarizer availability:", availability);
    
    if (availability === "no") {
      throw new Error("Summarizer API is unavailable. Download model at chrome://components");
    }
    
    if (availability === "after-download") {
      announce("AI model needs to be downloaded. This may take a few minutes.");
      console.log("⏳ Model needs download...");
    }
    
    const headings = document.querySelectorAll("h1, h2, h3, h4, h5, h6");
    
    if (headings.length === 0) {
      announce("No section headings found on this page.");
      console.warn("⚠️ No headings found");
      return;
    }
    
    announce(`Generating summaries for ${headings.length} sections. This will take a moment.`);
    
    let successCount = 0;
    
    for (const [index, heading] of Array.from(headings).entries()) {
      // Delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      try {
        const headingText = heading.innerText.trim();
        
        if (!headingText || headingText.length > 200) continue;
        
        // Skip if already has a summary
        if (heading.hasAttribute("data-cognitive-summary")) continue;
        
        // Get section content
        const sectionContent = getSectionContent(heading);
        
        console.log(`📏 Section "${headingText}" content length: ${sectionContent.length} chars`);
        
        if (!sectionContent || sectionContent.length < 30) {
          console.log(`⏭️ Skipping ${headingText}: insufficient content (${sectionContent.length} chars)`);
          continue;
        }
        
        announce(`Processing section ${index + 1} of ${headings.length}: ${headingText}`);
        
        // Create summarizer for this section
        const summarizer = await window.Summarizer.create({
          type: "tldr",
          length: "short",
          monitor(m) {
            m.addEventListener('downloadprogress', (e) => {
              const percent = Math.round(e.loaded / e.total * 100);
              console.log(`📥 Model download: ${percent}%`);
            });
          }
        });
        
        // Generate summary
        const summary = await summarizer.summarize(sectionContent);
        summarizer.destroy();
        
        if (summary && summary.trim()) {
          // Mark heading as processed
          heading.setAttribute("data-cognitive-summary", "true");
          
          // Create summary box
          const summaryBox = document.createElement("div");
          summaryBox.className = "cognitive-section-summary";
          summaryBox.setAttribute("role", "note");
          summaryBox.style.cssText = `
            background: #f8f9fa;
            border-left: 3px solid #5f6368;
            padding: 10px 14px;
            margin: 8px 0 16px 0;
            border-radius: 6px;
            font-family: system-ui, sans-serif;
            font-size: 14px;
            line-height: 1.6;
            color: #202124;
          `;
          summaryBox.innerHTML = `<em>📝 ${summary}</em>`;
          
          // Insert after heading
          heading.insertAdjacentElement('afterend', summaryBox);
          
          successCount++;
          console.log(`✅ Summary ${index + 1}/${headings.length}: "${headingText}"`);
          
          // Progress announcements every 5 headings
          if ((index + 1) % 5 === 0) {
            announce(`Processed ${index + 1} of ${headings.length} sections.`);
          }
        }
        
      } catch (error) {
        console.error(`❌ Summary error for heading ${index + 1}:`, error);
      }
    }
    
    // Final announcement
    announce(`Section summaries complete. Generated ${successCount} summaries. Navigate the page to see them.`);
    console.log(`✅ Generated ${successCount}/${headings.length} summaries`);
    
  } catch (error) {
    console.error("❌ Section summaries error:", error);
    const errorMsg = error.message || "Unknown error";
    announce(`Section summaries failed. Error: ${errorMsg}`);
  }
}

// ============================================================
// CONTEXT FIXER FOR LINKS & BUTTONS
// ============================================================

async function fixContextLabels() {
  console.log("🔧 Fixing ambiguous links and buttons...");
  
  announce("Starting to fix ambiguous labels. Please wait.");
  
  try {
    // FIXED: Use window.LanguageModel
    if (!window.LanguageModel) {
      throw new Error("Language Model API not found. Need Chrome 138+ with flags enabled.");
    }
    
    const availability = await window.LanguageModel.availability();
    console.log("📊 Language Model availability:", availability);
    
    if (availability === "no") {
      throw new Error("Language Model API is unavailable. Download model at chrome://components");
    }
    
    if (availability === "after-download") {
      announce("AI model needs to be downloaded. Starting download.");
      console.log("⏳ Model needs download...");
    }
    
    // Find ambiguous elements
    const ambiguousTerms = [
      "click here", "here", "learn more", "read more", 
      "more", "continue", "next", "go", "view", "see"
    ];
    
    const linksAndButtons = document.querySelectorAll("a, button");
    const elementsToFix = [];
    
    for (const el of linksAndButtons) {
      const text = (el.innerText || el.textContent || "").trim().toLowerCase();
      const hasLabel = el.hasAttribute("aria-label") && el.getAttribute("aria-label").trim();
      
      // Check if needs fixing
      if (!hasLabel && (
        ambiguousTerms.includes(text) || 
        text.length < 3 ||
        text === ""
      )) {
        elementsToFix.push(el);
      }
    }
    
    if (elementsToFix.length === 0) {
      announce("No ambiguous elements found. All links and buttons have clear labels.");
      console.log("✅ No ambiguous elements found");
      return;
    }
    
    announce(`Fixing ${elementsToFix.length} ambiguous links and buttons. This may take a moment.`);
    
    let successCount = 0;
    
    // Create session
    const session = await window.LanguageModel.create({
      systemPrompt: "You are an accessibility assistant. Generate concise 3-5 word aria-label descriptions. No quotes or punctuation.",
      monitor(m) {
        m.addEventListener('downloadprogress', (e) => {
          const percent = Math.round(e.loaded / e.total * 100);
          console.log(`📥 Model download: ${percent}%`);
        });
      }
    });
    
    try {
      for (const [index, element] of elementsToFix.entries()) {
        // Delay between requests
        await new Promise(resolve => setTimeout(resolve, 600));
        
        try {
          const context = getElementContext(element);
          const currentText = element.innerText || element.textContent || "button";
          const href = element.href || "";
          
          const prompt = `Generate an aria-label for this element:
Text: "${currentText}"
URL: "${href}"
Context: "${context.substring(0, 200)}"
Label (3-5 words):`;
          
          const response = await session.prompt(prompt);
          
          // Clean response
          let label = response.trim().split("\n")[0];
          label = label.replace(/^["']|["']$/g, ""); // Remove quotes
          label = label.replace(/[.!?]$/, ""); // Remove punctuation
          label = label.substring(0, 60); // Limit length
          
          if (label && label.split(" ").length <= 8) {
            element.setAttribute("aria-label", label);
            element.setAttribute("data-cognitive-fixed", "true");
            successCount++;
            console.log(`✅ Fixed ${index + 1}/${elementsToFix.length}: "${currentText}" → aria-label="${label}"`);
            
            // Progress announcements every 10 elements
            if ((index + 1) % 10 === 0) {
              announce(`Processed ${index + 1} of ${elementsToFix.length} elements.`);
            }
          }
          
        } catch (error) {
          console.error(`❌ Label fix error for element ${index + 1}:`, error);
        }
      }
    } finally {
      session.destroy();
    }
    
    // Final announcement
    announce(`Label fixing complete. Fixed ${successCount} ambiguous elements with descriptive labels. Navigate the page to hear improved descriptions.`);
    console.log(`✅ Fixed ${successCount}/${elementsToFix.length} elements`);
    
  } catch (error) {
    console.error("❌ Context fixer error:", error);
    const errorMsg = error.message || "Unknown error";
    announce(`Label fixing failed. Error: ${errorMsg}`);
  }
}

// ============================================================
// MESSAGE LISTENER
// ============================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("📨 Received message:", message);
  
  // Handle ping request to check if script is loaded
  if (message.action === "ping") {
    sendResponse({ status: "pong" });
    return true;
  }
  
  switch (message.action) {
    case "generateOverview":
      generateOverview();
      sendResponse({ status: "started" });
      break;
      
    case "generateCues":
      generateCues();
      sendResponse({ status: "started" });
      break;
      
    case "fixLabels":
      fixContextLabels();
      sendResponse({ status: "started" });
      break;
      
    default:
      console.warn("⚠️ Unknown action:", message.action);
      sendResponse({ status: "unknown_action" });
  }
  
  return true; // Keep channel open for async response
});

// Initialize persistent live region on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', createPersistentLiveRegion);
} else {
  createPersistentLiveRegion();
}

console.log("✅ Cognitive Layer AI ready");