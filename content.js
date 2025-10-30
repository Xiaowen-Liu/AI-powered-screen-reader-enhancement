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
      
      // Announce with delay to ensure screen reader picks it up
      setTimeout(() => {
        announce(`AI Overview complete. ${summary}`);
      }, 500);
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
// COGNITIVE CUES FOR HEADINGS
// ============================================================

async function generateCues() {
  console.log("🗣️ Generating Section Cues...");
  
  announce("Starting section cues generation. Please wait.");
  
  try {
    // FIXED: Use window.LanguageModel instead of self.LanguageModel
    if (!window.LanguageModel) {
      throw new Error("Language Model API not found. Need Chrome 138+ with flags enabled.");
    }
    
    // Check availability
    const availability = await window.LanguageModel.availability();
    console.log("📊 Language Model availability:", availability);
    
    if (availability === "no") {
      throw new Error("Language Model API is unavailable. Download model at chrome://components");
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
    
    announce(`Generating contextual cues for ${headings.length} sections. This will take a moment.`);
    
    let successCount = 0;
    
    // Create session (reuse for all headings)
    const session = await window.LanguageModel.create({
      systemPrompt: "You are a cognitive accessibility assistant. Provide brief, clear descriptions in 12 words or less. No punctuation at the end.",
      monitor(m) {
        m.addEventListener('downloadprogress', (e) => {
          const percent = Math.round(e.loaded / e.total * 100);
          console.log(`📥 Model download: ${percent}%`);
        });
      }
    });
    
    try {
      for (const [index, heading] of Array.from(headings).entries()) {
        // Delay between requests
        await new Promise(resolve => setTimeout(resolve, 800));
        
        try {
          const headingText = heading.innerText.trim();
          
          if (!headingText || headingText.length > 200) continue;
          
          // Skip if already has a cue
          if (heading.hasAttribute("data-cognitive-cue")) continue;
          
          const prompt = `Describe what this section is about: "${headingText}"`;
          const response = await session.prompt(prompt);
          
          // Clean response
          let cue = response.trim().split("\n")[0];
          cue = cue.replace(/[.!?]$/, ""); // Remove ending punctuation
          cue = cue.substring(0, 100); // Limit length
          
          if (cue) {
            // Mark heading as processed
            heading.setAttribute("data-cognitive-cue", "true");
            // Add aria-description for screen readers
            heading.setAttribute("aria-description", cue);
            
            successCount++;
            console.log(`✅ Cue ${index + 1}/${headings.length}: "${headingText}" → "${cue}"`);
            
            // Progress announcements every 5 headings
            if ((index + 1) % 5 === 0) {
              announce(`Processed ${index + 1} of ${headings.length} sections.`);
            }
          }
          
        } catch (error) {
          console.error(`❌ Cue error for heading ${index + 1}:`, error);
        }
      }
    } finally {
      // Clean up session
      session.destroy();
    }
    
    // Final announcement
    announce(`Cognitive cues complete. Generated descriptions for ${successCount} sections. Navigate to headings to hear them.`);
    console.log(`✅ Generated ${successCount}/${headings.length} cues`);
    
  } catch (error) {
    console.error("❌ Cues generation error:", error);
    const errorMsg = error.message || "Unknown error";
    announce(`Section cues failed. Error: ${errorMsg}`);
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