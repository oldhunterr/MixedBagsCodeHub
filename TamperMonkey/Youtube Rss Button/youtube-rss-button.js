// ==UserScript==
// @name         YouTube RSS Button
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Add an RSS button for channels on YouTube.
// @author       oldhunterr
// @match        https://www.youtube.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Function to extract channel ID
    function getChannelId() {
        let channelId = null;
        const scriptTags = document.getElementsByTagName('script');
        for (let i = 0; i < scriptTags.length; i++) {
            const script = scriptTags[i];
            if (script.textContent.includes('ytInitialPlayerResponse')) {
                const match = script.textContent.match(/"channelId":"([^"]+)"/);
                if (match && match.length > 1) {
                    channelId = match[1];
                    break;
                }
            }
        }
        return channelId;
    }

    // Function to open RSS feed in new tab
    function openRSSFeed() {
        const channelId = getChannelId();
        if (channelId) {
            window.open(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, '_blank');
        } else {
            console.error('Channel ID not found.');
        }
    }

    // Create RSS button with YouTube icon styling
    function createRSSButton() {
        const subscribeButton = document.querySelector('#subscribe-button');
        if (subscribeButton) {
            const rssButton = document.createElement('img');
            rssButton.src = 'https://www.svgrepo.com/show/95552/rss-sign.svg';
            rssButton.alt = 'RSS';
            rssButton.style.width = '24px'; // Adjust the width here
            rssButton.style.height = '24px'; // Adjust the height here
            rssButton.style.marginLeft = '5px';
            rssButton.style.cursor = 'pointer';
            rssButton.onclick = openRSSFeed;
            subscribeButton.parentNode.insertBefore(rssButton, subscribeButton.nextSibling);
        } else {
            console.error('Subscribe button not found.');
        }
    }

    // Wait for subscribe button to load
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.target.id === 'subscribe-button') {
                observer.disconnect();
                createRSSButton();
            }
        });
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
})();
