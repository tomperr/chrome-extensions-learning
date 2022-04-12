// query buttons
let call_background = document.querySelector("#call_background");
let call_content = document.querySelector("#call_content");
let inject_content = document.querySelector("#inject_content");

call_background.addEventListener("click", () => {

    console.log("[EXTENSION] Calling background...");
    let port = chrome.runtime.connect({name: "joking"});
    port.postMessage({joke: "fart"});
    port.onMessage.addListener(function(msg) {
        console.log("[EXTENSIONS] Response: " + msg.answer);
    });

});

call_content.addEventListener("click", async () => {

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

inject_content.addEventListener("click", async () => {
    console.log("[EXTENSION] Injecting content...");

    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: changeBackgroundColor,
    });

});

const changeBackgroundColor = () => {
    console.log("[CONTENT SCRIPT] Changing background color")
    document.body.style.backgroundColor = "red";
}

const fetchNumberOfDivs = () => {
    console.log("[CONTENT SCRIPT] Fetching number of divs in page")
    let nb_divs = document.querySelectorAll("div").length;
    chrome.runtime.sendMessage({nb: nb_divs}, function(response) {
        console.log("[CONTENT SCRIPT] Sent: " + nb_divs);
    });
}