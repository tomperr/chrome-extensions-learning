// Background listener
chrome.runtime.onConnect.addListener(function(port) {
    console.log("[BACKGROUND] Port name: " + port.name);
    port.onMessage.addListener(function(msg) {
        switch (port.name) {
            case "joking":
                if (msg.joke === "fart")
                    port.postMessage({answer: "Funny guy :)"});
                break;
            case "cookies":
                if (msg.question === "number") {
                    // get all cookies async, send respond when api returns cookies
                    chrome.cookies.getAll({domain: "google.com"}, (res) => {
                        console.log("[BACKGROUND] Cookies: " + res.length);
                        port.postMessage({answer: res.length});
                    });
                }
                break;
        }
    });
    
});