// Background listener
chrome.runtime.onConnect.addListener(function(port) {
    console.log("[BACKGROUND] Port name: " + port.name);
    console.assert(port.name === "joking");
    port.onMessage.addListener(function(msg) {
        if (msg.joke === "fart")
            port.postMessage({answer: "Funny guy :)"});
    });
});