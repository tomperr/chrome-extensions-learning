
//-------------------------------------------------------------------------------
/*
Copyright (C) 2021-2022 Dino Bollinger, ETH Zürich, Information Security Group

This file is part of CookieBlock.

Released under the MIT License, see included LICENSE file.
*/
//-------------------------------------------------------------------------------

// local counters for debugging
var debug_httpRemovalCounter = 0;
var debug_httpsRemovalCounter = 0;
var debug_classifyAllCounter = [0, 0, 0, 0];

// debug performance timers (FE, FE + Prediction)
var debug_perfsum = [0.0, 0.0, 0.0];
var debug_perfsum_squared = [0.0, 0.0, 0.0];
var debug_maxTime = [0.0, 0.0, 0.0];
var debug_minTime = [1e10, 1e10, 1e10];

var debug_Ntotal = [0, 0, 0];
var debug_Nskipped = 0;

// Variables for all the user options, which is persisted in storage.local and storage.sync
// Retrieving these from disk all the time is a bottleneck.
var cblk_userpolicy = undefined;
var cblk_pscale = undefined;
var cblk_pause = undefined;
var cblk_ulimit = undefined;
var cblk_hconsent = undefined;
var cblk_exglobal = undefined;
var cblk_exfunc = undefined;
var cblk_exanal = undefined;
var cblk_exadvert = undefined;
var cblk_mintime = undefined;
var cblk_knowncookies = undefined;
var cblk_useinternal = undefined;

// lookup for known cookies, to prevent some critical login issues
// will be imported form an external file and kept here
var knownCookies_user = undefined;
var knownCookies_internal = undefined;

// key used to access the regular expression pattern in the known_cookies object
const regexKey = "~regex;";

/**
* Creates a new feature extraction input object from the raw cookie data.
* @param  {Object} cookie    Raw cookie data as received from the browser.
* @return {Promise<object>}  Feature Extraction input object.
*/
const createFEInput = function(cookie) {
    return {
      "name": encodeURI(cookie.name),
      "domain": encodeURI(cookie.domain),
      "path": encodeURI(cookie.path),
      "current_label": -1,
      "label_ts": 0,
      "storeId": encodeURI(cookie.storeId),
      "variable_data":
      [
        {
          "host_only": cookie.hostOnly,
          "http_only": cookie.httpOnly,
          "secure": cookie.secure,
          "session": cookie.session,
          "expirationDate": cookie.expirationDate,
          "expiry": datetimeToExpiry(cookie),
          "value": encodeURI(cookie.value),
          "same_site": encodeURI(cookie.sameSite),
          "timestamp": Date.now()
        }
      ]
    };
}

/**
 * Updates the existing feature extraction object with data from the new cookie.
 * Specifically, the variable data attribute will have the new cookie's data appended to it.
 * If the update limit is reached, the oldest update will be removed.
 * @param  {Object} storedFEInput   Feature Extraction input, previously constructed.
 * @param  {Object} rawCookie       New cookie data, untransformed.
 * @return {Promise<object>}        The existing cookie object, updated with new data.
 */
const updateFEInput = async function(storedFEInput, rawCookie) {

    let updateArray = storedFEInput["variable_data"];
    let updateLimit = cblk_ulimit;

    let updateStruct = {
        "host_only": rawCookie.hostOnly,
        "http_only": rawCookie.httpOnly,
        "secure": rawCookie.secure,
        "session": rawCookie.session,
        "expiry": datetimeToExpiry(rawCookie),
        "value": encodeURI(rawCookie.value),
        "same_site": encodeURI(rawCookie.sameSite),
        "timestamp": Date.now()
    };

    // remove head if limit reached
    if (updateArray.length >= updateLimit)
        updateArray.shift();

    updateArray.push(updateStruct);
    console.assert(updateArray.length > 1, "Error: Performed an update without appending to the cookie?");
    console.assert(updateArray.length <= updateLimit, "Error: cookie update limit still exceeded!");

    return storedFEInput;
};


/**
 * Using the cookie input, extract features from the cookie and classify it, retrieving a label.
 * @param  {Object} feature_input   Transformed cookie data input, for the feature extraction.
 * @return {Promise<Number>}        Cookie category label as an integer, ranging from [0,3].
 */
const classifyCookie = async function(cookieDat, feature_input) {

    // console.log("[BACKGROUND] entering classifyCookie");

    let features = extractFeatures(feature_input);
    console.log("[BACKGROUND] features extracted");
    console.log(features);
    //label = await predictClass(features, cblk_pscale);
    label = await predictClass(features, 1);
    
    // console.log("[BACKGROUND] leaving classifyCookie");

    return label;
};


/**
 * Retrieve the cookie, classify it, then apply the policy.
 * @param {Object} newCookie Raw cookie object directly from the browser.
 * @param {Object} storeUpdate Whether
 */
 const handleCookie = async function (newCookie){

    serializedCookie = createFEInput(newCookie);
    
    console.log("[BACKGROUND] serialized cookie:");
    console.log(serializedCookie);

    console.assert(serializedCookie !== undefined, "Cookie object was still undefined!");

    clabel = await classifyCookie(newCookie, serializedCookie);

    const queryInfo = {
        active: true,
        currentWindow: true
    };

    // get tab id
    chrome.tabs.query(queryInfo, tabs => {
        const currentTabId = tabs[0].id;
        const storageKey = "cookies_" + currentTabId;
        chrome.storage.sync.get([storageKey], function(result) {
            console.log('[BACKGROUND] Current cookies :');
            console.log(result)
        });
        //chrome.storage.local.set({[storageKey]:0})
    });

    console.log("[BACKGROUND] Label found: " + clabel);
}

// Load the default configuration
getExtensionFile(chrome.runtime.getURL("ext_data/default_config.json"), "json", (dConfig) => {
    initDefaults(dConfig, false)
});

// retrieve the configuration
getExtensionFile("ext_data/features.json", "json", setupFeatureResourcesCallback);

/**
* Listener that is executed any time a cookie is added, updated or removed.
* Classifies the cookie and rejects it based on user policy.
* @param {Object} changeInfo  Contains the cookie itself, and cause info.
*/
chrome.cookies.onChanged.addListener((changeInfo) => {
    /*
    if (!changeInfo.removed) {
        console.log("[BACKGROUND] changeInfo: ");
        console.log(changeInfo.cookie);
        handleCookie(changeInfo.cookie);
    }
    */
});

/**
 * Listener that is executed when a tab is updated. If it's the active one,
 * reset cookies storage
 */
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete' && tab.url) {
        
        /*
        console.log("[BACKGROUND] reset stored cookies");

        const queryInfo = {
            active: true,
            currentWindow: true
        };

        // get tab id
        chrome.tabs.query(queryInfo, tabs => {
            const currentTabId = tabs[0].id;
            // const storageKey = "cookies_" + currentTabId;
            // chrome.storage.local.set({[storageKey]:[{name: "empty"}]})

            chrome.webNavigation.getAllFrames({tabId: currentTabId}, frames => {
                console.log("[BACKGROUND] Frames:");
                console.log(frames);
            });

        });
        */

    }
});