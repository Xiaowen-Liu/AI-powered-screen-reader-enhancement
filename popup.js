// 添加全局错误捕获
window.addEventListener('error', (e) => {
  console.error('Global error:', e.error);
  showStatus(`❌ Error: ${e.error?.message || 'Unknown error'}`, "error");
});

console.log("🧠 Cognitive Layer popup script loading...");

/**
 * Shows status message in popup
 */
function showStatus(message, type = "info") {
  console.log(`[Status] ${type}: ${message}`);
  const statusEl = document.getElementById("status");
  if (!statusEl) {
    console.error("Status element not found!");
    return;
  }
  
  statusEl.textContent = message;
  statusEl.className = `show ${type}`;
  
  // Auto-hide after 5 seconds for non-loading states
  if (type !== "loading") {
    setTimeout(() => {
      statusEl.classList.remove("show");
    }, 5000);
  }
}

/**
 * Gets user-friendly label for action
 */
function getActionLabel(action) {
  const labels = {
    "generateOverview": "Generating overview",
    "generateCues": "Generating cues",
    "fixLabels": "Fixing labels"
  };
  return labels[action] || "Processing";
}

/**
 * Check if content script is already loaded
 */
async function isContentScriptLoaded(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { action: "ping" });
    return response?.status === "pong";
  } catch (error) {
    return false;
  }
}

/**
 * Sends a message to the active tab's content script
 */
async function sendMessageToTab(action) {
  console.log(`📤 Attempting to send action: ${action}`);
  
  try {
    // Get active tab
    const tabs = await chrome.tabs.query({ 
      active: true, 
      currentWindow: true 
    });
    
    console.log("Tabs found:", tabs.length);
    
    if (!tabs || tabs.length === 0) {
      showStatus("❌ No active tab found", "error");
      return;
    }
    
    const tab = tabs[0];
    console.log(`🔍 Active tab: ${tab.id} - ${tab.url}`);
    
    if (!tab.id) {
      showStatus("❌ Invalid tab ID", "error");
      return;
    }
    
    // Check if URL is accessible
    if (tab.url.startsWith('chrome://') || 
        tab.url.startsWith('chrome-extension://') ||
        tab.url.startsWith('edge://')) {
      showStatus("❌ Cannot run on browser internal pages", "error");
      return;
    }
    
    // Show loading status
    showStatus(`⏳ ${getActionLabel(action)}...`, "loading");
    
    // Check if content script is already loaded
    const isLoaded = await isContentScriptLoaded(tab.id);
    
    if (!isLoaded) {
      // Only inject if not already loaded
      try {
        console.log("📥 Content script not found, injecting...");
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        console.log("✅ Content script injected");
        // Wait for script to initialize
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (injectError) {
        console.error("❌ Script injection failed:", injectError);
        showStatus(`❌ Failed to inject script: ${injectError.message}`, "error");
        return;
      }
    } else {
      console.log("✅ Content script already loaded");
    }
    
    // Send message to content script
    console.log(`📨 Sending message to tab ${tab.id}...`);
    const response = await chrome.tabs.sendMessage(tab.id, { action });
    
    console.log("✅ Response received:", response);
    showStatus("✅ Processing... Check page for results", "success");
    
    // Check if user wants to keep popup open
    const keepOpen = document.getElementById("keepOpen")?.checked;
    
    if (!keepOpen) {
      setTimeout(() => {
        console.log("Closing popup...");
        window.close();
      }, 2500);
    }
    
  } catch (error) {
    console.error("❌ Send message error:", error);
    showStatus(`❌ Error: ${error.message}`, "error");
  }
}

/**
 * Check if Chrome Built-in AI is available (detailed)
 */
async function checkAIStatus() {
  showStatus("⏳ Checking AI status...", "loading");
  console.log("🔍 Starting AI status check...");
  
  try {
    const [tab] = await chrome.tabs.query({ 
      active: true, 
      currentWindow: true 
    });
    
    if (!tab || !tab.id) {
      showStatus("❌ No active tab", "error");
      return;
    }
    
    console.log(`Checking AI on tab ${tab.id}...`);
    
    // Inject detailed check script
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async () => {
        const status = {
          aiExists: typeof window.ai !== 'undefined',
          summarizerExists: typeof window.ai?.summarizer !== 'undefined',
          languageModelExists: typeof window.ai?.languageModel !== 'undefined',
          summarizerAvailability: null,
          languageModelAvailability: null
        };
        
        try {
          if (window.ai?.summarizer) {
            status.summarizerAvailability = await window.ai.summarizer.availability();
          }
        } catch (e) {
          status.summarizerError = e.message;
        }
        
        try {
          if (window.ai?.languageModel) {
            status.languageModelAvailability = await window.ai.languageModel.availability();
          }
        } catch (e) {
          status.languageModelError = e.message;
        }
        
        return status;
      }
    });
    
    if (!results || !results[0]) {
      showStatus("❌ Failed to check AI", "error");
      return;
    }
    
    const status = results[0].result;
    console.log("🔍 AI Status:", status);
    
    // Build status message
    let message = "";
    
    if (!status.aiExists) {
      message = "❌ window.ai not found\n\nSteps:\n1. Open chrome://flags\n2. Enable these flags:\n   • #prompt-api-for-gemini-nano\n   • #summarization-api-for-gemini-nano\n   • #optimization-guide-on-device-model\n3. Relaunch Chrome";
    } else if (!status.summarizerExists && !status.languageModelExists) {
      message = "❌ AI APIs not available\n\nwindow.ai exists but APIs missing.\nRelaunch Chrome after enabling flags.";
    } else {
      message = "📊 AI Status:\n\n";
      message += `Summarizer: ${status.summarizerAvailability || "N/A"}\n`;
      message += `Language Model: ${status.languageModelAvailability || "N/A"}\n`;
      
      const summOk = status.summarizerAvailability === "readily";
      const langOk = status.languageModelAvailability === "readily";
      
      if (summOk && langOk) {
        message = "✅ All AI features ready!\n\nYou can now use all functions.";
      } else if (status.summarizerAvailability === "after-download" || 
                 status.languageModelAvailability === "after-download") {
        message += "\n⏳ Model needs download.\nClick a feature button to start.";
      } else if (status.summarizerAvailability === "no" || 
                 status.languageModelAvailability === "no") {
        message += "\n❌ Model unavailable.\nVisit chrome://components\nand download 'Optimization Guide'";
      }
      
      if (status.summarizerError) {
        message += `\n\n⚠️ Summarizer error: ${status.summarizerError}`;
      }
      if (status.languageModelError) {
        message += `\n\n⚠️ Language Model error: ${status.languageModelError}`;
      }
    }
    
    showStatus(message, status.aiExists ? "info" : "error");
    
  } catch (error) {
    console.error("AI status check error:", error);
    showStatus(`❌ Check failed:\n${error.message}`, "error");
  }
}

/**
 * Initialize popup when DOM is ready
 */
document.addEventListener("DOMContentLoaded", () => {
  console.log("📋 Popup DOM loaded, initializing...");
  
  try {
    // Test if elements exist
    const overviewBtn = document.getElementById("overview");
    const cuesBtn = document.getElementById("cues");
    const fixLabelsBtn = document.getElementById("fixLabels");
    const checkAIBtn = document.getElementById("checkAI");
    const keepOpenCheckbox = document.getElementById("keepOpen");
    
    console.log("Elements found:", {
      overview: !!overviewBtn,
      cues: !!cuesBtn,
      fixLabels: !!fixLabelsBtn,
      checkAI: !!checkAIBtn,
      keepOpen: !!keepOpenCheckbox
    });
    
    // Overview button
    if (overviewBtn) {
      overviewBtn.addEventListener("click", () => {
        console.log("🔘 Overview button clicked");
        sendMessageToTab("generateOverview");
      });
    }
    
    // Section cues button
    if (cuesBtn) {
      cuesBtn.addEventListener("click", () => {
        console.log("🔘 Cues button clicked");
        sendMessageToTab("generateCues");
      });
    }
    
    // Fix labels button
    if (fixLabelsBtn) {
      fixLabelsBtn.addEventListener("click", () => {
        console.log("🔘 Fix labels button clicked");
        sendMessageToTab("fixLabels");
      });
    }
    
    // Check AI status button
    if (checkAIBtn) {
      checkAIBtn.addEventListener("click", async () => {
        console.log("🔘 Check AI button clicked");
        await checkAIStatus();
      });
    }
    
    // Show initial message
    showStatus("👋 Extension loaded successfully!\nClick 'Check AI Status' to begin.", "success");
    
    console.log("✅ Popup initialized successfully");
    
  } catch (error) {
    console.error("❌ Initialization error:", error);
    showStatus(`❌ Init error: ${error.message}`, "error");
  }
});

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  if (e.key === "1") {
    document.getElementById("overview")?.click();
  } else if (e.key === "2") {
    document.getElementById("cues")?.click();
  } else if (e.key === "3") {
    document.getElementById("fixLabels")?.click();
  } else if (e.key === "4") {
    document.getElementById("checkAI")?.click();
  }
});

console.log("✅ Popup script loaded successfully");