// ==UserScript==
// @name         Parse SMS Transaction Messages
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Adds button to parse and save transaction [Currently working on BISB]
// @author       oldhunterr
// @match        https://messages.google.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Create the "Scroll to Top" button
    const scrollToTopButton = document.createElement('button');
    scrollToTopButton.textContent = 'Scroll to Top';
    scrollToTopButton.style.zIndex = '9999';
    scrollToTopButton.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    scrollToTopButton.style.border = 'none';
    scrollToTopButton.style.padding = '10px 20px';

    var button = document.createElement('button');
    button.className = 'mat-mdc-menu-trigger mat-mdc-tooltip-trigger conversation-menu mdc-icon-button mat-mdc-icon-button mat-unthemed mat-mdc-button-base';

    // Create the span element for the ripple effect
    var span = document.createElement('span');
    span.className = 'mat-mdc-button-persistent-ripple mdc-icon-button__ripple';
    button.appendChild(span);

    // Create the mws-icon element
    var mwsIcon = document.createElement('mws-icon');
    mwsIcon.className = 'conversation-menu-icon';

    // Create the svg element
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('class', 'bi bi-arrow-up-short');
    svg.setAttribute('viewBox', '0 0 16 16');

    // Create the path element
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill-rule', 'evenodd');
    path.setAttribute('d', 'M8 12a.5.5 0 0 0 .5-.5V5.707l2.146 2.147a.5.5 0 0 0 .708-.708l-3-3a.5.5 0 0 0-.708 0l-3 3a.5.5 0 1 0 .708.708L7.5 5.707V11.5a.5.5 0 0 0 .5.5z');

    svg.appendChild(path);

    // Append the svg element to the mws-icon element
    mwsIcon.appendChild(svg);

    // Append the mws-icon element to the button element
    button.appendChild(mwsIcon);
    button.style.zIndex = '9999';
    // Append the button to the document body
    //right.appendChild(scrollToTopButton);
        setTimeout(() => {
        const rightContent = document.querySelector(".right-content");
        if (rightContent) {
            rightContent.appendChild(button);
        }else{
            console.log("No Working");
        }
    }, 5000); // 10 seconds (in milliseconds)

    // Function to scroll to the top of the content when the button is clicked
   // function scrollToTop() {
     //   const contentElement = document.querySelector('.content');
    //    console.log(contentElement);
     //   contentElement.scrollTo({ top: 0, behavior: 'smooth' });
    //}
    function scrollToTop() {
    const contentElement = document.querySelector('.content');
    const scrollStep = -contentElement.scrollTop / (500 / 15); // Adjust the duration and step values as needed

    const scrollInterval = setInterval(() => {
        if (contentElement.scrollTop !== 0) {
            contentElement.scrollTop += scrollStep;
        } else {
            clearInterval(scrollInterval);
        }
    }, 15); // Adjust the step interval as needed
    }

    function download() {
        const elements = document.getElementsByClassName('text-msg-content');
        const messages = [];

        for (let i = 0; i < elements.length; i++) {
            const textContent = elements[i].textContent;
            messages.push(textContent);
        }


        const transactions = extractTransactions(messages);
        // Create a JSON object
        const jsonData = { transactions };

        // Convert the JSON object to a string
        const jsonString = JSON.stringify(jsonData, null, 2);

        // Create a Blob with the JSON data
        const blob = new Blob([jsonString], { type: 'application/json' });

        // Create a URL for the Blob
        const url = URL.createObjectURL(blob);

        // Create a download link and trigger the download
        const a = document.createElement('a');
        a.href = url;
        a.download = 'messages.json';
        a.click();

        // Clean up the URL object
        URL.revokeObjectURL(url);
    }

    function extractTransactions(messages) {
        const successTransactions = [];
        const failedTransactions = [];
        const otpTransactions = [];


        for (const message of messages) {
            const amountMatch = message.match(/(USD|EUR|BHD)\s?([\d.]+)/);
            const dateMatch = message.match(/on (\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}|\d{2}\/\d{2})/);
            const cardNumberMatch = message.match(/(?:ending|card)\s?(\d+)|(account\s+(\d+x+)\d+)/);
            const keywordMatch = message.match(/(received|salary)/i); // Case-insensitive match for 'received' or 'salary'
            const balanceMatch = message.match(/(Balance|Bal\.|bal|Bal|balance)\s?((USD|EUR|BHD)\s?([\d.]+)|is\s?(USD|EUR|BHD)\s?([\d.]+))/);
            const otpMatch = message.match(/OTP/i); // Case-insensitive match for 'OTP'
            const containsArabic = /[\u0600-\u06FF]/.test(message);


            if (amountMatch && cardNumberMatch) {
                const fullAmount = amountMatch;
                const amount = parseFloat(amountMatch[2]);
                let date = "Null";
                if(dateMatch){
                    date = dateMatch[1];
                }
                let balance = null;
                if (balanceMatch) {
                    // Get the last match
                    const lastMatch = balanceMatch[balanceMatch.length - 1];
                    if (lastMatch) {
                        // Extract the amount from the last match
                        balance = parseFloat(lastMatch);
                    } else {
                        // If the amount is captured in a previous group
                        balance = parseFloat(balanceMatch[5] || balanceMatch[7] || balanceMatch[4]);
                    }
                }
                const cardNumber = cardNumberMatch[1];

                let transactionType = '-';
                if (keywordMatch) {
                    transactionType = '+';
                }

                successTransactions.push({
                    message: message,
                    account: cardNumber, // Assuming card number is the account
                    type: transactionType,
                    amount: amount,
                    date: date,
                    balance: balance
                });
            } else if (otpMatch) {
                otpTransactions.push({
                    message: message,
                    reason: "OTP detected"
                });
            } else {
                // Constructing a reason for failure
                let reason = "Incomplete transaction details. ";
                if (!amountMatch) {
                    reason += "Amount not found. ";
                }
                if (!dateMatch) {
                    reason += "Date not found. ";
                }
                if (!cardNumberMatch) {
                    reason += "Card number not found. ";
                }
                if (containsArabic) {
                    failedTransactions.push({
                        message: message,
                        reason: "Failed transaction in Arabic"
                    });
                }else{
                    failedTransactions.push({
                        message: message,
                        reason: reason
                    });
                }


                // Storing failed message along with reason

            }
        }

        const result = {
            raw: messages,
            success: successTransactions,
            failed: failedTransactions,
            opt: otpTransactions,
        };

        return result;
    }

    // Add event listeners
    button.addEventListener('click', download);


})();
