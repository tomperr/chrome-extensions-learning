// query buttons
let call_background = document.querySelector("#call_background");
let inject_content = document.querySelector("#inject_content");

call_background.addEventListener("click", () => {

    console.log("[EXTENSION] Calling background...");
    let port = chrome.runtime.connect({name: "joking"});
    port.postMessage({joke: "fart"});
    port.onMessage.addListener(function(msg) {
        console.log("[EXTENSIONS] Response: " + msg.answer);
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