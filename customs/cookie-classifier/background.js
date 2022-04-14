importScripts('./modules/third_party/lz-string.js');
importScripts('./modules/third_party/levenshtein.js');
importScripts('./modules/third_party/difflib-browser.js');
importScripts('./modules/globals.js');
importScripts('./modules/extractor.js');
importScripts('./modules/predictor.js');

// Background listener
chrome.runtime.onConnect.addListener((port) => {
    console.log("[BACKGROUND] Port name: " + port.name);
    port.onMessage.addListener(function(msg) {
        switch (port.name) {
            case "cookies":
                if (msg.question === "classify") {

                    console.log("[BACKGROUND] Getting cookies from " + msg.domain + " domain...");

                    // get all cookies async, send response when api returns cookies
                    chrome.cookies.getAll({domain: msg.domain}, async (allCookies) => {

                        // debug messages in background console
                        console.log("[BACKGROUND] Number of cookies found: " + allCookies.length);
                        console.log("[BACKGROUND] Cookies:");
                        console.log(allCookies)

                        for (let cookieDat of allCookies) {
                            await handleCookie(cookieDat, false, true);
                        }

                        // send response
                        port.postMessage({answer: allCookies.length});
                    });
                }
                break;
        }
    });
    
});

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
 const handleCookie = async function (newCookie, storeUpdate, overrideTimeCheck){

    //console.log("[BACKGROUND] entering handleCookie");
    serializedCookie = createFEInput(newCookie);
    
    console.log("[BACKGROUND] serialized cookie:");
    console.log(serializedCookie);

    console.assert(serializedCookie !== undefined, "Cookie object was still undefined!");

    clabel = await classifyCookie(newCookie, serializedCookie);
    console.log("[BACKGROUND] Label found: " + clabel);
    //console.log("[BACKGROUND] leaving handleCookie");
}

/**
* Listener that is executed any time a cookie is added, updated or removed.
* Classifies the cookie and rejects it based on user policy.
* @param {Object} changeInfo  Contains the cookie itself, and cause info.
*/
chrome.cookies.onChanged.addListener((changeInfo) => {
    //console.log(changeInfo);
    if (!changeInfo.removed) {
        handleCookie(changeInfo.cookie, true, false);
    }
});

/**
 * Listener function that opens the first time setup when the extension is installed.
 * @param {Object} details Contains the reason for the change.
 */
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === "install") {
        chrome.tabs.create({"active": true, "url": "/options/cookieblock_setup.html"});
    }
});

// Load the default configuration
getExtensionFile(chrome.runtime.getURL("ext_data/default_config.json"), "json", (dConfig) => {
    initDefaults(dConfig, false)
});

// retrieve the configuration
getExtensionFile("ext_data/features.json", "json", setupFeatureResourcesCallback);
