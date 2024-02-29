// ==UserScript==
// @name         Random Border Color for Divs
// @namespace    http://localhost:9080/SQLMonitor/
// @version      1.0
// @description  Assign random border color to divs in Sql Monitor Page (Hasan Habib)
// @author       oldhunterr
// @match        http://localhost:9080/SQLMonitor/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Function to generate a random hex color that is different from the given color
    function getRandomColor(existingColor) {
        let newColor;
        do {
            newColor = '#' + Math.floor(Math.random() * 16777215).toString(16);
        } while (Math.abs(parseInt(existingColor.substring(1), 16) - parseInt(newColor.substring(1), 16)) < 500000);

        return newColor;
    }

    // Function to assign random border color to divs border and header
    function assignRandomBorderColor() {
        const divs = document.querySelectorAll('div.card.mt-3.ng-scope');
        divs.forEach(div => {
            const existingColor = window.getComputedStyle(div).borderColor;
            const color = getRandomColor(existingColor);
            div.style.border = `4px solid ${color}`;
            div.querySelector('.card-header').style.backgroundColor = color;
        });
    }

    // Create a container for the circular button
    const buttonContainer = document.createElement('div');
    buttonContainer.style.position = 'fixed';
    buttonContainer.style.bottom = '20px';
    buttonContainer.style.right = '20px';
    buttonContainer.style.zIndex = '9999';
    buttonContainer.style.width = '75px';
    buttonContainer.style.height = '75px';
    buttonContainer.style.backgroundColor = '#007bff';
    buttonContainer.style.borderRadius = '50%';
    buttonContainer.style.display = 'flex';
    buttonContainer.style.alignItems = 'center';
    buttonContainer.style.justifyContent = 'center';
    buttonContainer.style.cursor = 'pointer';
    buttonContainer.addEventListener('click', assignRandomBorderColor);

    // Create the text element for the button
    const buttonText = document.createElement('span');
    buttonText.textContent = 'Random';
    buttonText.style.color = '#fff';
    buttonText.style.fontWeight = 'bold';

    // Append the text element to the container
    buttonContainer.appendChild(buttonText);

    // Append the button container to the body
    document.body.appendChild(buttonContainer);
})();
