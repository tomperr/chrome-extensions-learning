chrome.webRequest.onHeadersReceived.addListener(function(details){
    /*
    var blockingResponse = {};
    details.requestHeaders.some(function(header){
        if( header.name == 'Cookie' ) {
            console.log("Original Cookie value:" + header.value);
            return true;
        }
        return false;
    });
    blockingResponse.requestHeaders = details.requestHeaders;
    return blockingResponse;
    */
    console.log(details);
}, {urls: [ "<all_urls>" ]});