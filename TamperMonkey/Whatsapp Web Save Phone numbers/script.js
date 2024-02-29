// ==UserScript==
// @name         WhatsApp Web Unsaved Contacts Logger
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Log unsaved contacts on WhatsApp Web
// @author       oldhunterr
// @match        https://web.whatsapp.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let unsavedContacts = new Set(); // To store unique unsaved contacts

    // Function to check for new unsaved contacts
    function checkForUnsavedContacts() {
        let unsavedContactElements = document.querySelectorAll('.ggj6brxn[title^="+"]');
        unsavedContactElements.forEach(element => {
            let contactNumber = element.textContent;
            if (!unsavedContacts.has(contactNumber)) {
                unsavedContacts.add(contactNumber);
            }
        });
    }

    // Function to log unsaved contacts
    function logUnsavedContacts() {
        if (unsavedContacts.size > 0) {
            console.log("Unsaved Contacts:"+unsavedContacts.size);
            unsavedContacts.forEach(contact => {
                console.log(contact);
            });
            let contactsString = Array.from(unsavedContacts).join('\n');
            let blob = new Blob([contactsString], { type: 'text/plain' });
            let fileName = 'Buri.txt';
            let link = document.createElement('a');
            link.download = fileName;
            link.href = window.URL.createObjectURL(blob);
            link.click();
        } else {
            console.log("No unsaved contacts found.");
        }
    }

    // Interval to continuously check for new unsaved contacts
    setInterval(checkForUnsavedContacts, 3000); // Check every 3 seconds

    // Event listener for the button press to log unsaved contacts
    window.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') { // Change 'Enter' to the desired key
            logUnsavedContacts();
        }
    });
})();
