import * as msgs from "./messages.js"

const leftPanel = document.getElementById('left-panel');
const rightPanel = document.getElementById('right-panel');
const container = document.querySelector('.container');
const chatInput = document.getElementById('chat-input');
const chatHistory = document.getElementById('chat-history');
const sendButton = document.getElementById('send-button');
const inputSection = document.getElementById('input-section');
const statusSection = document.getElementById('status-section');
const chatsSection = document.getElementById('chats-section');
const scrollbarThumb = document.querySelector('#chat-history::-webkit-scrollbar-thumb'); 

let autoScroll = true;
let context = "";

// Initialize the toggle button 
setupSidebarToggle(); 

function isMobile() {
    return window.innerWidth <= 768;
  }
  
  function toggleSidebar() {
    leftPanel.classList.toggle('hidden');
    rightPanel.classList.toggle('expanded');
  }
  
  function handleResize() {  
    if (isMobile()) {
      leftPanel.classList.add('hidden');
      rightPanel.classList.add('expanded');
    } else {
      leftPanel.classList.remove('hidden');
      rightPanel.classList.remove('expanded');
    }
  }
  
  // Run on startup and window resize
  window.addEventListener('load', handleResize);
  window.addEventListener('resize', handleResize);
  
  function setupSidebarToggle() {
    const leftPanel = document.getElementById('left-panel');
    const rightPanel = document.getElementById('right-panel');
    const toggleSidebarButton = document.getElementById('toggle-sidebar');
    if (toggleSidebarButton) {
      toggleSidebarButton.addEventListener('click', toggleSidebar);
    } else {
      console.error('Toggle sidebar button not found');
      setTimeout(setupSidebarToggle, 100);
    }
  }
    // Make sure to call this function
    document.addEventListener('DOMContentLoaded', setupSidebarToggle);

async function sendMessage() {
    const message = chatInput.value.trim();
    if (message) {
    
        const response = await sendJsonData("/msg", { text: message, context });
    
        //setMessage('user', message);
        chatInput.value = '';
        adjustTextareaHeight();
    }
}
    
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});
    
sendButton.addEventListener('click', sendMessage);

function updateUserTime() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const ampm = hours >= 12 ? 'pm' : 'am';
    const formattedHours = hours % 12 || 12; 

    // Format the time
    const timeString = `${formattedHours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} ${ampm}`;

    // Format the date
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    const dateString = now.toLocaleDateString(undefined, options);

    // Update the HTML
    const userTimeElement = document.getElementById('time-date');
    userTimeElement.innerHTML = `${timeString}<br><span id="user-date">${dateString}</span>`;
}
  
updateUserTime();
setInterval(updateUserTime, 1000);
    
function setMessage(id, type, heading, content, kvps = null) {
    // Search for the existing message container by id
    let messageContainer = document.getElementById(`message-${id}`);

    if (messageContainer) {
        // Clear the existing container's content if found
        messageContainer.innerHTML = '';
    } else {
        // Create a new container if not found
        const sender = type === 'user' ? 'user' : 'ai';
        messageContainer = document.createElement('div');
        messageContainer.id = `message-${id}`;
        messageContainer.classList.add('message-container', `${sender}-container`);
    }

    const handler = msgs.getHandler(type);
    handler(messageContainer, id, type, heading, content, kvps);

    // If the container was found, it was already in the DOM, no need to append again
    if (!document.getElementById(`message-${id}`)) {
        chatHistory.appendChild(messageContainer);
    }

    if (autoScroll) chatHistory.scrollTop = chatHistory.scrollHeight;
}

function adjustTextareaHeight() {
    chatInput.style.height = 'auto';
    chatInput.style.height = (chatInput.scrollHeight) + 'px';
}

async function sendJsonData(url, data) {
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        throw new Error('Network response was not ok');
    }

    const jsonResponse = await response.json();
    return jsonResponse;
}

function generateGUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0;
        var v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

let lastLogVersion = 0;
let lastLogGuid = ""

async function poll() {
    try {
        const response = await sendJsonData("/poll", { log_from: lastLogVersion, context });
        //console.log(response)

        if (response.ok) {

            setContext(response.context)

            if (lastLogGuid != response.log_guid) {
                chatHistory.innerHTML = ""
                lastLogVersion = 0
            }

            if (lastLogVersion != response.log_version) {
                for (const log of response.logs) {
                    setMessage(log.no, log.type, log.heading, log.content, log.kvps);
                }
            }

            //set ui model vars from backend
            const inputAD = Alpine.$data(inputSection);
            inputAD.paused = response.paused;
            const statusAD = Alpine.$data(statusSection);
            statusAD.connected = response.ok;
            const chatsAD = Alpine.$data(chatsSection);
            chatsAD.contexts = response.contexts;

            lastLogVersion = response.log_version;
            lastLogGuid = response.log_guid;


        }

    } catch (error) {
        console.error('Error:', error);
        const statusAD = Alpine.$data(statusSection);
        statusAD.connected = false;
    }
}

function updatePauseButtonState(isPaused) {
    const pauseButton = document.getElementById('pause-button');
    const unpauseButton = document.getElementById('unpause-button');
    
    if (isPaused) {
        pauseButton.style.display = 'none';
        unpauseButton.style.display = 'flex';
    } else {
        pauseButton.style.display = 'flex';
        unpauseButton.style.display = 'none';
    }
}

window.pauseAgent = async function (paused) {
    const resp = await sendJsonData("/pause", { paused: paused, context });
    updatePauseButtonState(paused);
}

window.resetChat = async function () {
    const resp = await sendJsonData("/reset", { context });
}

window.newChat = async function () {
    setContext(generateGUID());
}

window.killChat = async function (id) {


    const chatsAD = Alpine.$data(chatsSection);
    let found, other
    for (let i = 0; i < chatsAD.contexts.length; i++) {
        if (chatsAD.contexts[i].id == id) {
            found = true
        } else {
            other = chatsAD.contexts[i]
        }
        if (found && other) break
    }

    if (context == id && found) {
        if (other) setContext(other.id)
        else setContext(generateGUID())
    }
    
    if (found) sendJsonData("/remove", { context: id });
}

window.selectChat = async function (id) {
    setContext(id)
}

const setContext = function (id) {
    if (id == context) return
    context = id
    lastLogGuid = ""
    lastLogVersion = 0
    const chatsAD = Alpine.$data(chatsSection);
    chatsAD.selected = id
}

window.toggleAutoScroll = async function (_autoScroll) {
    autoScroll = _autoScroll;
}

window.toggleJson = async function (showJson) {
    // add display:none to .msg-json class definition
    toggleCssProperty('.msg-json', 'display', showJson ? 'block' : 'none');
}

window.toggleThoughts = async function (showThoughts) {
    // add display:none to .msg-json class definition
    toggleCssProperty('.msg-thoughts', 'display', showThoughts ? undefined : 'none');
}


window.toggleDarkMode = function(isDark) {
    if (isDark) {
      document.body.classList.remove('light-mode');
    } else {
      document.body.classList.add('light-mode');
    }
    console.log("Dark mode:", isDark);
    localStorage.setItem('darkMode', isDark);
};
  
  document.addEventListener('DOMContentLoaded', () => {
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    toggleDarkMode(isDarkMode);
  });

function toggleCssProperty(selector, property, value) {
    // Get the stylesheet that contains the class
    const styleSheets = document.styleSheets;

    // Iterate through all stylesheets to find the class
    for (let i = 0; i < styleSheets.length; i++) {
        const styleSheet = styleSheets[i];
        const rules = styleSheet.cssRules || styleSheet.rules;

        for (let j = 0; j < rules.length; j++) {
            const rule = rules[j];
            if (rule.selectorText == selector) {
                // Check if the property is already applied
                if (value === undefined) {
                    rule.style.removeProperty(property);
                } else {
                    rule.style.setProperty(property, value); 
                }
                return;
            }
        }
    }
}

chatInput.addEventListener('input', adjustTextareaHeight);

setInterval(poll, 100);
