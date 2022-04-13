// query DOM elements
let classify_button = document.querySelector("#classify");

// add onclick event
classify_button.addEventListener("click", () => {

    console.log("[POPUP] classify button clicked");

    // query current tab
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {

        let tab = tabs[0];
        let url = new URL(tab.url)
        let domain = url.hostname

        // send message
        let port = chrome.runtime.connect({name: "cookies"});
        port.postMessage({
            question: "classify",
            domain: domain
        });
        console.log("[POPUP] Message sent!");

        // get response
        port.onMessage.addListener(function(msg) {
            console.log("[POPUP] Response: " + msg.answer);
        });
      })

    

});