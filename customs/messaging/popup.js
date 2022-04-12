// query buttons
let call_extension_background = document.querySelector("#call_extension_background");
let call_extension_content = document.querySelector("#call_extension_content");
let call_content_background = document.querySelector("#call_content_background");
let inject_content = document.querySelector("#inject_content");

// Calling background and getting response
call_extension_background.addEventListener("click", () => {

    console.log("[EXTENSION] Calling background...");

    let port = chrome.runtime.connect({name: "joking"});
    port.postMessage({joke: "fart"});
    port.onMessage.addListener(function(msg) {
        console.log("[EXTENSIONS] Response: " + msg.answer);
    });

});

// Calling content and getting response
call_extension_content.addEventListener("click", async () => {

    console.log("[EXTENSION] Calling content...");

    chrome.runtime.onMessage.addListener(
        function(request, sender, sendResponse) {
            console.log("[EXTENSION] Message received from content script");
            if (request.nb) {
                console.log("[EXTENSION] Nb divs: " + request.nb);
                sendResponse({});
            }
        }
    );

    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: fetchNumberOfDivs,
    });

});

// Injecting script in content
inject_content.addEventListener("click", async () => {

    console.log("[EXTENSION] Injecting content...");

    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: changeBackgroundColor,
    });

});

// Injecting script in content, that calls background and receive a response
call_content_background.addEventListener("click", async () => {

    console.log("[EXTENSION] Calling content...");

    chrome.runtime.onMessage.addListener(
        function(request, sender, sendResponse) {
            console.log("[EXTENSION] Message received from content script");
            if (request.nb) {
                console.log("[EXTENSION] Nb cookies: " + request.nb);
                sendResponse({});
            }
        }
    );

    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: askNbCookies,
    });

});

// script to inject
const changeBackgroundColor = () => {
    console.log("[CONTENT SCRIPT] Changing background color")
    document.body.style.backgroundColor = "red";
}

// script to inject to communicate with extension
const fetchNumberOfDivs = () => {
    console.log("[CONTENT SCRIPT] Fetching number of divs in page")
    let nb_divs = document.querySelectorAll("div").length;
    chrome.runtime.sendMessage({nb: nb_divs}, function(response) {
        console.log("[CONTENT SCRIPT] Sent: " + nb_divs);
    });
}

// script to inject to communicate with background
const askNbCookies = () => {
    console.log("[CONTENT SCRIPT] Asking background number of cookies")
    let port = chrome.runtime.connect({name: "cookies"});
    port.postMessage({question: "number"});
    port.onMessage.addListener(function(msg) {
        console.log("[CONTENT SCRIPT] Response: " + msg.answer);
    });
}