// ==UserScript==
// @name          WebSphere Admin Helper With Master Config
// @namespace     http://tampermonkey.net/
// @version       5.0
// @description   Add custom properties and change heap sizes in IBM WebSphere with auto-navigation
// @author        You
// @match         https://localhost:9043/ibm/console/*
// @grant         GM_setValue
// @grant         GM_getValue
// @run-at        document-end
// @author        salalawi
// ==/UserScript==

(function () {
    'use strict';

    // --- CRUCIAL FIX 1: Stop execution in child frames (prevents 3 UIs) ---
    // If the current window is not the top window (meaning it's a frame), stop script execution.
    if (window.self !== window.top) {
        console.log('WebSphere Helper: Running in a frame. Halting execution in this frame.');
        return;
    }
    // -----------------------------------------------------------------------

    console.log('WebSphere Helper: Script loaded in top window. Proceeding with GUI creation.');

    // Common WebSphere custom properties templates
    const propertyTemplates = {
        'Performance': [
            { name: 'com.ibm.ws.webcontainer.channelwritetype', value: 'async' },
            { name: 'com.ibm.ws.webcontainer.disabletcpcache', value: 'false' },
            { name: 'com.ibm.io.async.maxIOThreads', value: '50' }
        ],
        'Connection Pool': [
            { name: 'connectionTimeout', value: '180' },
            { name: 'maxConnections', value: '50' },
            { name: 'minConnections', value: '10' }
        ],
        'Session Management': [
            { name: 'sessionDatabasePersistence', value: 'true' },
            { name: 'invalidationTimeout', value: '30' },
            { name: 'maxInMemorySessionCount', value: '1000' }
        ],
        'JVM Options': [
            { name: 'genericJvmArguments', value: '-Xgcpolicy:gencon' },
            { name: 'verboseModeGarbageCollection', value: 'true' }
        ]
    };

    // Store properties
    let properties = [];
    let isProcessing = false;
    let propertyStats = { added: 0, skipped: 0, errors: 0 };


    // --- Helper Functions for Frame Navigation and Element Interaction ---

    /**
     * Tries to find and return the document object of the 'detail' (content) frame.
     * @returns {Document} The detail frame document.
     * @throws {Error} If the detail frame or its document is not found.
     */
    function getDetailFrameDoc() {
        const frames = window.frames;
        const count = frames.length;

        for (let i = 0; i < count; i++) {
            const frame = frames[i];
            if (frame && frame.name === 'detail' && frame.document) {
                return frame.document;
            }
        }

        if (window.name === 'detail' && document) {
            return document;
        }

        throw new Error('Detail frame not found (name="detail").');
    }



    /**
     * Polls the top window for the 'navigation' frame document to be ready.
     * This handles the race condition where the frame element exists but the document inside is not yet loaded.
     */
    function waitForNavigationFrameDoc(timeout = 10000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const interval = setInterval(() => {
                const navFrame = window.frames[1];
                // Check if the frame exists, has a document, and the document is ready/complete
                if (navFrame && navFrame.document && (navFrame.document.readyState === 'complete' || navFrame.document.querySelector('a'))) {
                    clearInterval(interval);
                    resolve(navFrame.document);
                } else if (Date.now() - startTime > timeout) {
                    clearInterval(interval);
                    reject(new Error('Timeout waiting for navigation frame document to load.'));
                }
            }, 500);
        });
    }

    /**
     * Polls the detail frame for a specified element to appear.
     * @param {string} selector - The CSS selector for the element.
     * @param {number} timeout - Maximum time to wait in ms.
     * @returns {Promise<Element>} Resolves with the found element.
     */
    function waitForElement(selector, timeout = 10000, intervalMs = 300) {
        return new Promise((resolve, reject) => {
            const start = Date.now();

            const timer = setInterval(() => {
                try {
                    const raw = getDetailFrameDoc();
                    const doc = resolveDocument(raw);
                    if (!doc) return;

                    const el = doc.querySelector(selector);
                    if (el) {
                        clearInterval(timer);
                        resolve(el);
                        return;
                    }

                    if (Date.now() - start > timeout) {
                        clearInterval(timer);
                        reject(new Error(`Timeout waiting for selector: ${selector}`));
                    }
                } catch (err) {
                    if (Date.now() - start > timeout) {
                        clearInterval(timer);
                        reject(new Error(`Timeout waiting for frame/document for selector: ${selector}`));
                    }
                }
            }, intervalMs);
        });
    }


    function resolveDocument(obj) {
        if (!obj) return null;
        if (obj.nodeType === 9) return obj;          // already a Document
        if (obj.document?.nodeType === 9) return obj.document;
        return null;
    }


    /**
     * Clicks a link in the navigation panel (left-hand side).
     * @param {string} linkText - The text content of the link.
     */
    async function clickNavigationLink(linkText) {
        logProgress(`Attempting to click navigation link: ${linkText}`);

        try {
            // FIX: Wait for the navigation frame document to be ready before trying to search it.
            const doc = await waitForNavigationFrameDoc();

            // Navigation links are expected to be in the nav frame and target the 'detail' frame
            const links = doc.querySelectorAll('a[target="detail"]');

            for (const link of links) {
                // Use includes for flexibility, as link text might contain padding/tags
                if (link.textContent.trim().includes(linkText)) {
                    link.click();
                    logProgress(`Clicked navigation link: ${linkText}`);
                    await waitForPageLoad();
                    return;
                }
            }
            throw new Error(`Navigation link not found: ${linkText}`);
        } catch (e) {
            // The original error "Timeout waiting for navigation frame document to load." will be propagated from waitForNavigationFrameDoc
            throw new Error(`Failed to click navigation link: ${e.message}`);
        }
    }

    /**
     * Waits for a short delay for page loading transition.
     */
    function waitForPageLoad(delay = 1500) {
        return new Promise(resolve => setTimeout(resolve, delay));
    }

    /**
     * Clicks the server link in the detail frame list.
     * @param {string} serverName - The name of the server to click.
     */
    async function clickServerLink(serverName) {
        logProgress(`Waiting for server link '${serverName}' in the list...`);
        const selector = `a:is([title], [href]):not([target]):not([onclick])`;

        try {
            const doc = getDetailFrameDoc();
            await waitForElement(selector, 15000);

            const links = doc.querySelectorAll('a');
            for (const link of links) {
                if (link.textContent.trim() === serverName) {
                    link.click();
                    logProgress(`Clicked server link: ${serverName}`);
                    await waitForPageLoad();
                    return;
                }
            }
            throw new Error(`Server link not found in list: ${serverName}`);
        } catch (error) {
            throw new Error(`Failed to click server link: ${error.message}`);
        }
    }

    // --- NEW: JDBC Provider Configuration ---
    // async function createJDBCProvider(providerConfig) {
    //     const {
    //         databaseType = 'User-defined',
    //         providerName = 'Postgres JDBC Provider',
    //         implementationClass = 'org.postgresql.ds.PGConnectionPoolDataSource',
    //         classPath = 'D:/postgresql-42.3.4.jar'
    //     } = providerConfig;

    //     try {
    //         logProgress('Navigating to JDBC Providers...');

    //         // Navigate: Resources > JDBC > JDBC Providers
    //         await clickNavigationLink('JDBC providers');
    //         await waitForPageLoad();

    //         logProgress('Selecting scope (Node=Server=)...');
    //         // Select scope from dropdown - look for the last option (Node=Server=)
    //         const doc = getDetailFrameDoc();
    //         const scopeDropdown = await waitForElement('select', 10000);
    //         const options = scopeDropdown.options;
    //         scopeDropdown.selectedIndex = options.length - 1; // Select last option

    //         // Trigger change event
    //         const event = new Event('change', { bubbles: true });
    //         scopeDropdown.dispatchEvent(event);
    //         await waitForPageLoad(2000);

    //         logProgress('Clicking New button...');
    //         const newButton = await waitForElement('input[value="New..."], button[value="New..."]', 15000);
    //         newButton.click();
    //         await waitForPageLoad();

    //         logProgress('Configuring JDBC Provider...');

    //         // Step 1: Database type selection
    //         const dbTypeSelect = doc.querySelector('select[name*="databaseType"], select[id*="databaseType"]');
    //         if (dbTypeSelect) {
    //             // Find "User-defined" option
    //             for (let i = 0; i < dbTypeSelect.options.length; i++) {
    //                 if (dbTypeSelect.options[i].text.includes('User-defined') ||
    //                     dbTypeSelect.options[i].value.includes('User-defined')) {
    //                     dbTypeSelect.selectedIndex = i;
    //                     dbTypeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    //                     break;
    //                 }
    //             }
    //         }
    //         await waitForPageLoad(1000);

    //         // Provider Name
    //         const nameInputs = doc.querySelectorAll('input[type="text"]');
    //         const providerNameInput = Array.from(nameInputs).find(
    //             inp => inp.id?.toLowerCase().includes('name') || inp.name?.toLowerCase().includes('name')
    //         );
    //         if (providerNameInput) {
    //             providerNameInput.value = providerName;
    //             logProgress(`Set Provider Name: ${providerName}`);
    //         }

    //         // Implementation Class Name
    //         const implClassInput = Array.from(nameInputs).find(
    //             inp => inp.id?.toLowerCase().includes('implementation') ||
    //                 inp.name?.toLowerCase().includes('implementation') ||
    //                 inp.id?.toLowerCase().includes('class')
    //         );
    //         if (implClassInput) {
    //             implClassInput.value = implementationClass;
    //             logProgress(`Set Implementation Class: ${implementationClass}`);
    //         }

    //         // Click Next
    //         let nextButton = doc.querySelector('input[value="Next"], button:contains("Next")');
    //         if (nextButton) {
    //             nextButton.click();
    //             logProgress('Clicked Next');
    //             await waitForPageLoad();
    //         }

    //         // Step 2: Class Path
    //         logProgress('Setting Class Path...');
    //         const classPathInput = await waitForElement('input[type="text"]', 10000);
    //         classPathInput.value = classPath;
    //         logProgress(`Set Class Path: ${classPath}`);

    //         // Click Finish
    //         const finishButton = doc.querySelector('input[value="Finish"], button:contains("Finish")');
    //         if (finishButton) {
    //             finishButton.click();
    //             logProgress('Clicked Finish');
    //             await waitForPageLoad(3000);
    //         }

    //         // Save configuration
    //         const saveButton = doc.querySelector('input[value="Save"], button:contains("Save")');
    //         if (saveButton) {
    //             saveButton.click();
    //             logProgress('Saved JDBC Provider configuration', 'success');
    //             await waitForPageLoad(3000);
    //         }

    //         return { success: true };
    //     } catch (error) {
    //         logProgress(`Error creating JDBC Provider: ${error.message}`, 'error');
    //         throw error;
    //     }
    // }


    async function createJDBCProvider(providerConfig) {
        const {
            databaseType = 'User-defined',
            providerName = 'Postgres JDBC Provider',
            implementationClass = 'org.postgresql.ds.PGConnectionPoolDataSource',
            classPath = 'D:/postgresql-42.3.4.jar'
        } = providerConfig;

        try {
            logProgress('Navigating to JDBC Providers...');

            // Navigate: Resources > JDBC > JDBC Providers
            await clickNavigationLink('JDBC providers');
            await waitForPageLoad();

            logProgress('Selecting scope (Node=Server=)...');
            const doc = getDetailFrameDoc();
            const scopeDropdown = await waitForElement('select', 10000);
            const options = scopeDropdown.options;
            scopeDropdown.selectedIndex = options.length - 1; // Select last option (Node=Server=)


            // Test if provider exist
            logProgress('Checking if provider exist..');
            if (jdbcProviderExists(providerName)) {
                logProgress('Provider Exist');
                return;
            } else {
                logProgress('Provider Not Exist Creating New');
            }

            // Trigger change event
            scopeDropdown.dispatchEvent(new Event('change', { bubbles: true }));
            await waitForPageLoad(2000);

            logProgress('Clicking New button...');
            const newButton = await waitForElement('input[value="New..."]', 10000);
            newButton.click();
            await waitForPageLoad(2000);

            logProgress('Step 1: Configuring JDBC Provider...');

            // Step 1: Select Database type = "User-defined"
            const dbTypeSelect = await waitForElement('select#dbType', 10000);

            // Find and select "User-defined" option
            for (let i = 0; i < dbTypeSelect.options.length; i++) {
                if (dbTypeSelect.options[i].value === 'User-defined') {
                    dbTypeSelect.selectedIndex = i;
                    logProgress('Selected Database type: User-defined');

                    // Manually trigger the onchange event - this will reload the page
                    // The getDriver() function will be called which reloads the page
                    const changeEvent = new Event('change', { bubbles: true });
                    dbTypeSelect.dispatchEvent(changeEvent);

                    // Wait for page reload after selecting User-defined
                    await waitForPageLoad(3000);
                    break;
                }
            }

            // After page reload, we need to get the document again
            logProgress('Setting Implementation Class Name...');

            // Wait for the implementation class input to appear (this appears after User-defined is selected)
            const implClassInput = await waitForElement('input#userdefinedImplClass', 10000);
            if (implClassInput) {
                // Clear the default placeholder value and set our implementation class
                implClassInput.value = implementationClass;
                logProgress(`Set Implementation Class: ${implementationClass}`);
            } else {
                throw new Error('Implementation class input not found');
            }

            // Set Provider Name (should already be enabled for User-defined)
            logProgress('Setting Provider Name...');

            const nameInput = await waitForElement('input#name', 10000);
            //const nameInput = doc.querySelector('input#name');
            if (nameInput && !nameInput.disabled) {
                nameInput.value = providerName;
                logProgress(`Set Provider Name: ${providerName}`);
            } else {
                throw new Error('Name field not found or disabled');
            }

            // Set Description (optional but good practice)
            const descInput = doc.querySelector('textarea#description');
            if (descInput && !descInput.disabled) {
                descInput.value = `${providerName} for PostgreSQL database`;
                logProgress('Set Provider Description');
            }


            logProgress('updating doc');
            //doc = getDetailFrameDoc();

            // Click Next to go to Step 2 (Class Path)
            logProgress('Clicking Next to proceed to Step 2...');
            //console.log(doc.document.querySelector('input[value="Next"]#next, input[name="installAction"][value="Next"]'));

            //console.log(doc.querySelector('input[value="Next"]#next, input[name="installAction"][value="Next"]'));

            const nextButton = window[2].frames.document.querySelector('input[value="Next"]#next, input[name="installAction"][value="Next"]');
            if (nextButton) {
                nextButton.click();
                logProgress('Clicked Next');
                await waitForPageLoad();
            }

            // Step 2: Enter database class path information
            logProgress('Step 2: Setting Class Path...');

            // Wait for class path input field to appear
            await waitForPageLoad(1000);

            // Find the class path input field - look for textarea or input with 'classpath' in id/name
            const classPathField = await waitForElement(
                'textarea[name*="classpath"], textarea[id*="classpath"], input[name*="classpath"], input[id*="classpath"],textarea#classPath',
                10000
            );

            if (classPathField) {
                classPathField.value = classPath;
                logProgress(`Set Class Path: ${classPath}`);
            } else {
                // Fallback: try to find any textarea on the page
                const textareas = doc.querySelectorAll('textarea:not([disabled])');
                if (textareas.length > 0) {
                    textareas[0].value = classPath;
                    logProgress(`Set Class Path (fallback): ${classPath}`);
                } else {
                    throw new Error('Class path field not found');
                }
            }

            // Click Next to go to Step 3 (Summary)
            logProgress('Clicking Next to proceed to Summary...');
            const nextButton2 = await waitForElement('input[value="Next"]#next, input[name="installAction"][value="Next"]', 10000);
            if (nextButton2) {
                nextButton2.click();
                await waitForPageLoad(2000);
            } else {
                throw new Error('Second Next button not found');
            }

            // Step 3: Summary - Click Finish
            logProgress('Step 3: Summary - Clicking Finish...');
            const finishButton = await waitForElement('input[value="Finish"]', 10000);
            if (finishButton) {
                finishButton.click();
                logProgress('Clicked Finish');
                await waitForPageLoad(3000);
            } else {
                throw new Error('Finish button not found');
            }

            // Save configuration
            logProgress('Saving configuration...');
            const saveButton = doc.querySelector('input[value="Save"]');
            if (saveButton) {
                saveButton.click();
                logProgress('JDBC Provider created and saved successfully!', 'success');
                await waitForPageLoad(3000);
            } else {
                logProgress('Warning: Save button not found. Please save manually.', 'error');
            }

            return { success: true };
        } catch (error) {
            logProgress(`Error creating JDBC Provider: ${error.message}`, 'error');
            throw error;
        }
    }

    function jdbcProviderExists(providerName) {
        let doc = getDetailFrameDoc();

        const nameCells = doc.querySelectorAll('[id^="nameCollectionDiv"] a');

        for (let i = 0; i < nameCells.length; i++) {
            const text = nameCells[i].textContent.trim();
            if (text === providerName) {
                return true;
            }
        }

        return false;
    }

    async function createDataSource(dsConfig) {
        const {
            dataSourceName = 'EMSDataSource',
            jndiName = 'jdbc/EMSDataSource',
            jdbcProvider = 'Postgres JDBC Provider',
            customProperties = {
                databaseName: 'emspostgresdev',
                serverName: 'emspostgres-dev.cluster-cvrapba7u1xu.me-south-1.rds.amazonaws.com',
                portNumber: '5432',
                user: 'devuser',
                password: 'passw0rd123.devuser',
                currentSchema: 'EMS',
                sslmode: 'disable'
            }
        } = dsConfig;

        try {
            logProgress('Navigating to Data Sources...');

            // Navigate: Resources > JDBC > Data sources
            await clickNavigationLink('Data sources');
            await waitForPageLoad();

            logProgress('Selecting scope (Node=Server=)...');
            const doc = getDetailFrameDoc();
            const scopeDropdown = await waitForElement('select', 10000);
            const options = scopeDropdown.options;
            scopeDropdown.selectedIndex = options.length - 1;
            scopeDropdown.dispatchEvent(new Event('change', { bubbles: true }));
            await waitForPageLoad(2000);

            logProgress('Checking if DataSource Exist');
            if (!jdbcProviderExists(dataSourceName)) {

                logProgress('DataSource Not Exist .. Creating New One');

                logProgress('Clicking New button...');
                const newButton = await waitForElement('input[value="New..."], button[value="New..."]', 15000);
                newButton.click();
                await waitForPageLoad();

                // Step 1: Data source name and JNDI
                logProgress('Configuring Data Source...');
                const inputs = doc.querySelectorAll('input[type="text"]');

                const dsNameInput = await waitForElement('input#name', 10000);
                if (dsNameInput) {
                    dsNameInput.value = dataSourceName;
                    logProgress(`Set Data Source Name: ${dataSourceName}`);
                }

                const jndiInput = await waitForElement('input#jndiName', 10000);
                if (jndiInput) {
                    jndiInput.value = jndiName;
                    logProgress(`Set JNDI Name: ${jndiName}`);
                }

                // Click Next
                logProgress(`Clicking Next`);
                let nextButton = await waitForElement('input[value="Next"]#next, input[name="installAction"][value="Next"]', 10000);
                if (nextButton) {
                    nextButton.click();
                    await waitForPageLoad(3000);
                }

                // Step 2: Select JDBC Provider
                logProgress(`Selecting JDBC Provider: ${jdbcProvider}...`);

                const existingRadio = await waitForElement('input#existing');

                if (existingRadio) {
                    logProgress(`Radio found`);
                }

                existingRadio.click();

                const selectProvider = await waitForElement('#jdbcProviderName', 10000);

                const opt = [...selectProvider.options].find(o =>
                    o.value.includes(jdbcProvider)
                );

                if (!opt) logProgress('Not Found')

                selectProvider.value = opt.value;
                selectProvider.dispatchEvent(new Event('change', { bubbles: true }));

                await waitForPageLoad();

                // Click Next twice

                logProgress('Clicking Next 1')
                nextButton = await waitForElement('input[value="Next"]', 10000);
                if (nextButton) {
                    nextButton.click();
                    await waitForPageLoad();

                    logProgress('Clicking Next 2')
                    nextButton = await waitForElement('input[value="Next"]'), 10000;
                    if (nextButton) {
                        nextButton.click();
                        await waitForPageLoad();
                        logProgress('Clicking Next 3')
                        nextButton = await waitForElement('input[value="Next"]'), 10000;
                        if (nextButton) {
                            nextButton.click();
                            await waitForPageLoad();
                        }
                    }
                }

                // Click Finish
                const finishButton = await waitForElement('input#finish,input[value="Finish"]#finish, input[name="installAction"][value="Finish"]');
                if (finishButton) {
                    finishButton.click();
                    logProgress('Clicked Finish', 'success');
                    await waitForPageLoad(3000);
                }

            } else {

                logProgress('DataSource Exist Skipping ...');
                await waitForPageLoad(3000);
            }
            // Save
            /*
            let saveButton = doc.querySelector('input[value="Save"], button:contains("Save")');
            if (saveButton) {
                saveButton.click();
                await waitForPageLoad(3000);
            } */

            // Step 3: Configure Custom Properties
            logProgress('Configuring Custom Properties...');

            // Click on the newly created data source
            await clickLinkInDetailFrame(dataSourceName);
            await waitForPageLoad(5000);

            // Click Custom properties
            await clickLinkInDetailFrame('Custom properties');
            await waitForPageLoad(10000);

            // Set each custom property
            for (const [propName, propValue] of Object.entries(customProperties)) {
                try {
                    logProgress(`Processing property: ${propName}`);

                    // Check if property exists and get its current value and link
                    const existsResult = await propertyExistsMatchValue(propName, propValue);

                    if (existsResult.exists && existsResult.matches) {
                        logProgress(`Property "${propName}" already has correct value "${propValue}" - skipping`, 'info');
                        continue;
                    }

                    if (existsResult.exists && !existsResult.matches) {
                        logProgress(`Property "${propName}" exists with value "${existsResult.currentValue}", updating to "${propValue}"`, 'info');

                        // Use the link we already found
                        if (existsResult.link) {
                            existsResult.link.click();
                            logProgress(`Clicked property: ${propName}`);
                            await waitForPageLoad(2000);

                            // Set the value
                            const valueInput = await waitForElement('input#value, input[name="value"]', 10000);
                            valueInput.value = propValue;
                            logProgress(`Updated value to: ${propValue}`);

                            // Click OK
                            const okButton = await waitForElement('input[type="submit"][value="OK"], input[name="save"][value="OK"]', 10000);
                            if (okButton) {
                                okButton.click();
                                logProgress(`Clicked OK for ${propName}`);
                                await waitForPageLoad(5000);
                            } else {
                                logProgress(`Warning: OK button not found for ${propName}`, 'error');
                            }

                            continue; // Move to next property
                        }
                    }

                    // If property doesn't exist or link wasn't found, search manually
                    if (!existsResult.exists) {
                        logProgress(`Property "${propName}" not found - it may need to be created first`, 'error');
                    }

                } catch (error) {
                    logProgress(`Error setting property ${propName}: ${error.message}`, 'error');
                }
            }


            // Final Save
            /*
                    saveButton = doc.querySelector('input[value="Save"], button:contains("Save")');
                    if (saveButton) {
                        saveButton.click();
                        logProgress('Saved all Data Source configurations', 'success');
                        await waitForPageLoad(3000);
                    }
                    */
            return { success: true };
        } catch (error) {
            logProgress(`Error creating Data Source: ${error.message}`, 'error');
            throw error;
        }
    }

    // --- NEW: Navigation Functions for JDBC ---
    async function navigateAndCreateJDBCProvider() {
        if (isProcessing) {
            showStatus('Already processing, please wait...', 'error');
            return;
        }

        const providerName = document.getElementById('jdbc-provider-name').value;
        const implClass = document.getElementById('jdbc-impl-class').value;
        const classPath = document.getElementById('jdbc-classpath').value;

        if (!providerName || !implClass || !classPath) {
            showStatus('Please fill all JDBC Provider fields', 'error');
            return;
        }

        isProcessing = true;
        document.getElementById('create-jdbc-provider-btn').disabled = true;
        document.getElementById('progress-log').innerHTML = '';

        try {
            await createJDBCProvider({
                providerName,
                implementationClass: implClass,
                classPath
            });

            showStatus('JDBC Provider created successfully!', 'success');
        } catch (error) {
            showStatus(`Error: ${error.message}`, 'error');
        } finally {
            isProcessing = false;
            document.getElementById('create-jdbc-provider-btn').disabled = false;
        }
    }

    async function navigateAndCreateDataSource() {
        if (isProcessing) {
            showStatus('Already processing, please wait...', 'error');
            return;
        }

        const dsName = document.getElementById('ds-name').value;
        const jndiName = document.getElementById('ds-jndi').value;
        const jdbcProvider = document.getElementById('ds-jdbc-provider').value;

        const customProps = {
            databaseName: document.getElementById('ds-db-name').value,
            serverName: document.getElementById('ds-server-name').value,
            portNumber: document.getElementById('ds-port').value,
            user: document.getElementById('ds-user').value,
            password: document.getElementById('ds-password').value,
            currentSchema: document.getElementById('ds-schema').value,
            sslmode: document.getElementById('ds-sslmode').value,
            sslMode: document.getElementById('ds-sslmode').value
        };

        if (!dsName || !jndiName) {
            showStatus('Please fill required Data Source fields', 'error');
            return;
        }

        isProcessing = true;
        document.getElementById('create-datasource-btn').disabled = true;
        document.getElementById('progress-log').innerHTML = '';

        try {
            await createDataSource({
                dataSourceName: dsName,
                jndiName: jndiName,
                jdbcProvider: jdbcProvider,
                customProperties: customProps
            });

            showStatus('Data Source created successfully!', 'success');
        } catch (error) {
            showStatus(`Error: ${error.message}`, 'error');
        } finally {
            isProcessing = false;
            document.getElementById('create-datasource-btn').disabled = false;
        }
    }

    // --- NEW: Navigation Functions for JDBC ---
    async function navigateAndCreateJDBCProvider() {
        if (isProcessing) {
            showStatus('Already processing, please wait...', 'error');
            return;
        }

        const providerName = document.getElementById('jdbc-provider-name').value;
        const implClass = document.getElementById('jdbc-impl-class').value;
        const classPath = document.getElementById('jdbc-classpath').value;

        if (!providerName || !implClass || !classPath) {
            showStatus('Please fill all JDBC Provider fields', 'error');
            return;
        }

        isProcessing = true;
        document.getElementById('create-jdbc-provider-btn').disabled = true;
        document.getElementById('progress-log').innerHTML = '';

        try {
            await createJDBCProvider({
                providerName,
                implementationClass: implClass,
                classPath
            });

            showStatus('JDBC Provider created successfully!', 'success');
        } catch (error) {
            showStatus(`Error: ${error.message}`, 'error');
        } finally {
            isProcessing = false;
            document.getElementById('create-jdbc-provider-btn').disabled = false;
        }
    }

    /*
    async function navigateAndCreateDataSource() {
        if (isProcessing) {
            showStatus('Already processing, please wait...', 'error');
            return;
        }

        const dsName = document.getElementById('ds-name').value;
        const jndiName = document.getElementById('ds-jndi').value;
        const jdbcProvider = document.getElementById('ds-jdbc-provider').value;

        const customProps = {
            databaseName: document.getElementById('ds-db-name').value,
            serverName: document.getElementById('ds-server-name').value,
            portNumber: document.getElementById('ds-port').value,
            user: document.getElementById('ds-user').value,
            password: document.getElementById('ds-password').value,
            currentSchema: document.getElementById('ds-schema').value,
            sslmode: document.getElementById('ds-sslmode').value,
            sslMode: document.getElementById('ds-sslmode').value,
        };

        if (!dsName || !jndiName) {
            showStatus('Please fill required Data Source fields', 'error');
            return;
        }

        isProcessing = true;
        document.getElementById('create-datasource-btn').disabled = true;
        document.getElementById('progress-log').innerHTML = '';

        try {
            await createDataSource({
                dataSourceName: dsName,
                jndiName: jndiName,
                jdbcProvider: jdbcProvider,
                customProperties: customProps
            });

            showStatus('Data Source created successfully!', 'success');
        } catch (error) {
            showStatus(`Error: ${error.message}`, 'error');
        } finally {
            isProcessing = false;
            document.getElementById('create-datasource-btn').disabled = false;
        }
    }

    */

    /**
     * Clicks a link within the detail frame (e.g., 'Process definition').
     * @param {string} linkText - The text content of the link.
     */
    async function clickLinkInDetailFrame(linkText) {
        logProgress(`Waiting for inner link: ${linkText}...`);
        const selector = `a[title*='${linkText}'], a:not([target])`;

        try {
            const doc = getDetailFrameDoc();
            await waitForElement(selector, 15000);

            const links = doc.querySelectorAll('a');
            for (const link of links) {
                if (link.textContent.trim().includes(linkText)) {
                    link.click();
                    logProgress(`Clicked inner link: ${linkText}`);
                    await waitForPageLoad();
                    return;
                }
            }
            throw new Error(`Link not found in detail frame: ${linkText}`);
        } catch (error) {
            throw new Error(`Failed to click link in detail frame: ${error.message}`);
        }
    }

    /**
     * Sets the Initial and Maximum Heap Size values and clicks Apply/OK.
     */
    async function setHeapSizes(initial, max) {
        logProgress('Waiting for heap size input fields...');

        await waitForElement('input[value="Apply"], input[value="OK"]', 15000);

        const doc = getDetailFrameDoc();

        const inputs = doc.querySelectorAll('input[type="text"], input[type="number"]');
        let initialSet = false;
        let maxSet = false;

        const initialHeapInput = Array.from(inputs).find(
            input => input.id?.includes('initial') || input.name?.includes('initial') || input.id?.includes('xms')
        ) || inputs[0];

        const maxHeapInput = Array.from(inputs).find(
            input => input.id?.includes('maximum') || input.name?.includes('maximum') || input.id?.includes('xmx')
        ) || inputs[1];

        if (initialHeapInput) {
            initialHeapInput.value = initial;
            initialSet = true;
            logProgress(`Set Initial Heap Size to ${initial} MB.`);
        }

        if (maxHeapInput) {
            maxHeapInput.value = max;
            maxSet = true;
            logProgress(`Set Maximum Heap Size to ${max} MB.`);
        }

        if (!initialSet || !maxSet) {
            throw new Error('Could not reliably find or set both heap size input fields. Manual input may be required.');
        }

        const buttons = doc.querySelectorAll('input[type="submit"], input[type="button"], button');
        const applyButton = Array.from(buttons).find(
            button => button.value?.includes('Apply') || button.value?.includes('OK') || button.textContent?.includes('Apply') || button.textContent?.includes('OK')
        );

        if (applyButton) {
            applyButton.click();
            logProgress('Clicked Apply/OK button.');
            await waitForPageLoad(2000);
        } else {
            logProgress('Warning: Could not find Apply/OK button, settings might not be saved!', 'error');
        }
    }


    async function propertyExistsMatchValue(propertyName, expectedValue) {
        try {
            const doc = getDetailFrameDoc();

            // Wait for the properties table to load
            const table = await waitForElement('table.framing-table', 5000);
            const rows = table.querySelectorAll('tr.table-row');

            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const nameLink = row.querySelector('div[id^="nameCollectionDiv"] a');

                if (!nameLink) continue;

                const name = nameLink.textContent.trim();
                if (name !== propertyName) continue;

                // Found the property, now check its value
                const valueDiv = row.querySelector('div[id^="valueCollectionDiv"]');
                const currentValue = valueDiv?.textContent.trim() || '';

                // Property exists - check if value matches
                if (currentValue === expectedValue) {
                    return { exists: true, matches: true, currentValue, link: nameLink };
                } else {
                    return { exists: true, matches: false, currentValue, link: nameLink };
                }
            }

            // Property not found at all
            return { exists: false, matches: false, currentValue: null, link: null };

        } catch (error) {
            logProgress(`Error checking property "${propertyName}": ${error.message}`, 'error');
            return { exists: false, matches: false, currentValue: null, link: null };
        }
    }

    /**
 * Checks if a property already exists in the properties table
 * @param {string} propertyName - The name of the property to check
 * @returns {boolean} True if property exists, false otherwise
 */
    async function propertyExists(propertyName) {
        try {
            const doc = getDetailFrameDoc();

            await waitForElement('table.framing-table', 5000);

            const nameCells = doc.querySelectorAll('div[id^="nameCollectionDiv"]');

            for (const cell of nameCells) {
                const link = cell.querySelector('a');
                if (link && link.textContent.trim() === propertyName) {
                    logProgress(`Property "${propertyName}" already exists - skipping`, 'info');
                    return true;
                }
            }

            return false;
        } catch (error) {
            logProgress(`Error checking if property exists: ${error.message}`, 'error');
            return false;
        }
    }

    /**
     * Adds a custom property (Name and Value) and saves it - with duplicate check
     */
    async function addCustomProperty(name, value) {
        // Check if property already exists
        const exists = await propertyExists(name);
        if (exists) {
            propertyStats.skipped++;
            return { success: true, skipped: true };
        }

        try {
            logProgress('Waiting for Custom Properties page...');

            // 1. Wait for the 'New' button to ensure page is loaded
            const newButton = await waitForElement('input[value="New..."], button[value="New..."]', 15000);
            newButton.click();
            logProgress('Clicked "New" button.');

            // 2. Wait for the new property dialog/form to load
            await waitForPageLoad();
            logProgress('Waiting for property entry fields...');

            const doc = getDetailFrameDoc();

            // Use specific IDs ('name' and 'value') from the HTML for reliable input
            const nameInput = await waitForElement('input#name', 15000);
            const valueInput = doc.querySelector('input#value');

            if (nameInput && valueInput) {
                nameInput.value = name;
                valueInput.value = value;
                logProgress(`Entered property: ${name} = ${value}`);
            } else {
                throw new Error('Could not find property name/value input fields using IDs "name" and "value".');
            }

            // 3. Click OK in the property dialog
            const okButton = doc.querySelector('input[type="submit"][value="OK"]');

            if (okButton) {
                okButton.click();
                logProgress('Clicked OK to save property.');
                await waitForPageLoad();

                // 4. Click Save on the main property list screen
                const saveButtons = doc.querySelectorAll('input[value="Save"], button');
                const saveButton = Array.from(saveButtons).find(
                    button => button.value === 'Save' || button.textContent.includes('Save')
                );
                if (saveButton) {
                    saveButton.click();
                    logProgress('Clicked Save on the main configuration page.');
                    await waitForPageLoad(3000);
                } else {
                    logProgress('Warning: Could not find Save button. Changes may be lost after session timeout or server restart!', 'error');
                }

                propertyStats.added++;
                return { success: true, skipped: false };
            } else {
                throw new Error('Could not find OK button to save the new property.');
            }
        } catch (error) {
            propertyStats.errors++;
            throw error;
        }
    }

    /**
     * Navigate and apply properties
     */
    async function navigateAndApplyProperties() {
        if (isProcessing) {
            showStatus('Already processing, please wait...', 'error');
            return;
        }

        if (properties.length === 0) {
            showStatus('No properties to apply', 'error');
            return;
        }

        const serverName = document.getElementById('server-name').value;

        isProcessing = true;
        document.getElementById('navigate-properties-btn').disabled = true;
        document.getElementById('progress-log').innerHTML = '';

        // Reset stats
        propertyStats = { added: 0, skipped: 0, errors: 0 };

        try {
            logProgress(`Starting to process ${properties.length} custom properties...`);

            // Navigate to server
            logProgress('Navigating to WebSphere application servers...');
            await clickNavigationLink('WebSphere application servers');

            logProgress(`Looking for server: ${serverName}`);
            await clickServerLink(serverName);

            logProgress('Expanding Java and Process Management...');
            await clickLinkInDetailFrame('Process definition');

            logProgress('Opening Java Virtual Machine settings...');
            await clickLinkInDetailFrame('Java Virtual Machine');

            logProgress('Opening Custom Properties...');
            await clickLinkInDetailFrame('Custom properties');

            // Add each property with duplicate detection
            for (let i = 0; i < properties.length; i++) {
                const prop = properties[i];
                logProgress(`Processing property ${i + 1}/${properties.length}: ${prop.name}`);

                try {
                    const result = await addCustomProperty(prop.name, prop.value);
                    if (result.skipped) {
                        logProgress(`Skipped duplicate: ${prop.name}`, 'info');
                    } else {
                        logProgress(`Added: ${prop.name}`, 'success');
                    }
                } catch (error) {
                    logProgress(`Failed to add ${prop.name}: ${error.message}`, 'error');
                    // Continue with next property instead of stopping
                }
            }

            // Show final summary
            const summary = `Completed! Added: ${propertyStats.added}, Skipped: ${propertyStats.skipped}, Errors: ${propertyStats.errors}`;
            logProgress(summary, 'success');
            showStatus(summary, propertyStats.errors > 0 ? 'error' : 'success');

        } catch (error) {
            logProgress(`Error: ${error.message}`, 'error');
            showStatus(`Error: ${error.message}`, 'error');
        } finally {
            isProcessing = false;
            document.getElementById('navigate-properties-btn').disabled = false;
            // Clear properties from the GUI list after applying
            clearProperties();
        }
    }

    // --- GUI and Utility Functions ---

    // Create floating GUI
    function createGUI() {

        console.log('WebSphere Helper: Creating GUI');

        // Remove existing GUI if present
        const existingGUI = document.getElementById('websphere-helper-gui');
        if (existingGUI) {
            existingGUI.remove();
        }

        const gui = document.createElement('div');
        gui.id = 'websphere-helper-gui';
        gui.innerHTML = `
    <style>
        /* Keep all existing styles... */
        #websphere-helper-gui {
            position: fixed;
            top: 20px;
            right: 20px;
            width: 500px;
            background: #fff;
            border: 2px solid #0f62fe;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 2147483647 !important;
            font-family: Arial, sans-serif;
            max-height: 90vh;
            overflow-y: auto;
        }
        #websphere-helper-gui.minimized {
            width: 200px;
            height: auto;
        }
        #websphere-helper-gui.minimized .gui-content {
            display: none;
        }
        .gui-header {
            background: #0f62fe;
            color: white;
            padding: 12px;
            cursor: move;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .gui-title {
            font-weight: bold;
            font-size: 14px;
        }
        .gui-controls {
            display: flex;
            gap: 5px;
        }
        .gui-btn {
            background: transparent;
            border: 1px solid white;
            color: white;
            cursor: pointer;
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 12px;
        }
        .gui-btn:hover {
            background: rgba(255,255,255,0.2);
        }
        .gui-content {
            padding: 15px;
        }
        .section {
            margin-bottom: 20px;
        }
        .section-title {
            font-weight: bold;
            margin-bottom: 10px;
            color: #0f62fe;
            border-bottom: 1px solid #e0e0e0;
            padding-bottom: 5px;
        }
        .input-group {
            margin-bottom: 10px;
        }
        .input-group label {
            display: block;
            margin-bottom: 3px;
            font-size: 12px;
            color: #333;
        }
        .input-group input, .input-group select {
            width: 100%;
            padding: 6px;
            border: 1px solid #ccc;
            border-radius: 4px;
            box-sizing: border-box;
            font-size: 13px;
        }
        .input-group textarea {
            width: 100%;
            padding: 8px;
            border: 1px solid #ccc;
            border-radius: 4px;
            box-sizing: border-box;
            font-size: 11px;
            font-family: 'Courier New', monospace;
            resize: vertical;
        }
        .action-btn {
            background: #0f62fe;
            color: white;
            border: none;
            padding: 8px 15px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            width: 100%;
            margin-top: 5px;
        }
        .action-btn:hover:not(:disabled) {
            background: #0353e9;
        }
        .action-btn:disabled {
            background: #ccc;
            cursor: not-allowed;
        }
        .action-btn.secondary {
            background: #393939;
        }
        .action-btn.secondary:hover:not(:disabled) {
            background: #262626;
        }
        .action-btn.danger {
            background: #da1e28;
        }
        .action-btn.danger:hover:not(:disabled) {
            background: #ba1b23;
        }
        .property-list {
            max-height: 150px;
            overflow-y: auto;
            border: 1px solid #e0e0e0;
            border-radius: 4px;
            padding: 5px;
            margin-top: 5px;
        }
        .property-item {
            padding: 5px;
            background: #f4f4f4;
            margin-bottom: 5px;
            border-radius: 3px;
            font-size: 11px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            word-break: break-all;
        }
        .property-item button {
            background: #da1e28;
            color: white;
            border: none;
            padding: 2px 6px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 10px;
            flex-shrink: 0;
        }
        .property-item button:hover {
            background: #ba1b23;
        }
        .status-message {
            padding: 8px;
            border-radius: 4px;
            margin-top: 10px;
            font-size: 12px;
            display: none;
        }
        .status-message.success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        .status-message.error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        .status-message.info {
            background: #d1ecf1;
            color: #0c5460;
            border: 1px solid #bee5eb;
        }
        .progress-log {
            max-height: 150px;
            overflow-y: auto;
            border: 1px solid #e0e0e0;
            border-radius: 4px;
            padding: 8px;
            margin-top: 10px;
            font-size: 11px;
            font-family: 'Courier New', monospace;
            background: #f9f9f9;
            display: none;
        }
        .progress-log div {
            margin-bottom: 3px;
        }
        .json-example {
            background: #f5f5f5;
            border: 1px solid #ddd;
            padding: 8px;
            border-radius: 4px;
            font-size: 9px;
            margin-top: 5px;
            max-height: 120px;
            overflow-y: auto;
        }
        .json-example pre {
            margin: 0;
            font-family: 'Courier New', monospace;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
    </style>
    <div class="gui-header">
        <div class="gui-title">WebSphere Helper</div>
        <div class="gui-controls">
            <button class="gui-btn" id="minimize-btn">−</button>
            <button class="gui-btn" id="close-btn">×</button>
        </div>
    </div>
    <div class="gui-content">
        <!-- MASTER CONFIG SECTION -->
        <div class="section">
            <div class="section-title">Master Configuration (Optional)</div>
            <div class="input-group">
                <label>Load from MasterConfig.json:</label>
                <textarea id="master-config-json" rows="6" placeholder="Paste JSON here to auto-fill all fields below..."></textarea>
            </div>
            <button class="action-btn secondary" id="load-master-config-btn">Load Configuration into Fields</button>

            <div class="json-example" style="display: none;">
                <strong>Example:</strong>
                <pre>{
  "server": {"name": "server1", "heap": {"initial": 1024, "maximum": 2048}},
  "jdbcProvider": {"name": "Postgres JDBC Provider", "implementationClass": "org.postgresql.ds.PGConnectionPoolDataSource", "classPath": "D:/postgresql-42.3.4.jar"},
  "dataSource": {"name": "EMSDataSource", "jndiName": "jdbc/EMSDataSource", "jdbcProvider": "Postgres JDBC Provider",
    "customProperties": {"databaseName": "db", "serverName": "host", "portNumber": "5432", "user": "user", "password": "pass", "currentSchema": "schema", "sslmode": "disable"}},
  "jvmProperties": [{"name": "prop1", "value": "val1"}]
}</pre>
            </div>
        </div>

        <div class="section">
            <div class="section-title">Server Selection</div>
            <div class="input-group">
                <label>Server Name:</label>
                <input type="text" id="server-name" placeholder="server1" value="">
            </div>
        </div>

        <div class="section">
            <div class="section-title">Heap Size Configuration</div>
            <div class="input-group">
                <label>Initial Heap Size (MB):</label>
                <input type="number" id="initial-heap" placeholder="1024" value="">
            </div>
            <div class="input-group">
                <label>Maximum Heap Size (MB):</label>
                <input type="number" id="max-heap" placeholder="2048" value="">
            </div>
            <button class="action-btn" id="navigate-heap-btn">Navigate & Apply Heap</button>
        </div>

        <div class="section">
            <div class="section-title">Custom Properties</div>
            <div class="input-group">
                <label>Import from JSON:</label>
                <textarea id="json-input" placeholder='{"LDAP_Connect_Timeout": "1000"}' rows="3"></textarea>
                <button class="action-btn" id="import-json-btn">Import JSON</button>
            </div>

            <div style="text-align: center; margin: 10px 0; color: #999; font-size: 12px;">OR</div>

            <div class="input-group">
                <label>Property Name:</label>
                <input type="text" id="property-name" placeholder="com.ibm.ws.property">
            </div>
            <div class="input-group">
                <label>Property Value:</label>
                <input type="text" id="property-value" placeholder="value">
            </div>
            <button class="action-btn" id="add-property-btn">Add Property</button>

            <div class="property-list" id="property-list"></div>
            <button class="action-btn" id="navigate-properties-btn">Navigate & Apply Properties</button>
            <button class="action-btn secondary" id="clear-properties-btn">Clear All</button>
        </div>

        <div class="section">
            <div class="section-title">JDBC Provider Configuration</div>
            <div class="input-group">
                <label>Provider Name:</label>
                <input type="text" id="jdbc-provider-name" placeholder="Postgres JDBC Provider" value="">
            </div>
            <div class="input-group">
                <label>Implementation Class:</label>
                <input type="text" id="jdbc-impl-class" placeholder="org.postgresql.ds.PGConnectionPoolDataSource" value="">
            </div>
            <div class="input-group">
                <label>Class Path:</label>
                <input type="text" id="jdbc-classpath" placeholder="D:/postgresql-42.3.4.jar" value="">
            </div>
            <button class="action-btn" id="create-jdbc-provider-btn">Create JDBC Provider</button>
        </div>

        <div class="section">
            <div class="section-title">Data Source Configuration</div>
            <div class="input-group">
                <label>Data Source Name:</label>
                <input type="text" id="ds-name" placeholder="EMSDataSource" value="">
            </div>
            <div class="input-group">
                <label>JNDI Name:</label>
                <input type="text" id="ds-jndi" placeholder="jdbc/EMSDataSource" value="">
            </div>
            <div class="input-group">
                <label>Select JDBC Provider:</label>
                <input type="text" id="ds-jdbc-provider" placeholder="Postgres JDBC Provider" value="">
            </div>
            <div class="section-title" style="margin-top: 15px; font-size: 12px;">Custom Properties</div>
            <div class="input-group">
                <label>Database Name:</label>
                <input type="text" id="ds-db-name" placeholder="database" value="">
            </div>
            <div class="input-group">
                <label>Server Name:</label>
                <input type="text" id="ds-server-name" placeholder="hostname.rds.amazonaws.com" value="">
            </div>
            <div class="input-group">
                <label>Port Number:</label>
                <input type="text" id="ds-port" placeholder="5432" value="">
            </div>
            <div class="input-group">
                <label>User:</label>
                <input type="text" id="ds-user" placeholder="username" value="">
            </div>
            <div class="input-group">
                <label>Password:</label>
                <input type="password" id="ds-password" placeholder="password" value="">
            </div>
            <div class="input-group">
                <label>Current Schema:</label>
                <input type="text" id="ds-schema" placeholder="schema" value="">
            </div>
            <div class="input-group">
                <label>SSL Mode:</label>
                <input type="text" id="ds-sslmode" placeholder="disable" value="">
            </div>
            <button class="action-btn" id="create-datasource-btn">Create Data Source</button>
        </div>

        <div class="progress-log" id="progress-log"></div>
        <div class="status-message" id="status-message"></div>
    </div>
`;


        // --- CRUCIAL FIX 2: Append to the <html> element (solves GUI visibility issue in framesets) ---
        document.documentElement.appendChild(gui);
        console.log('WebSphere Helper: GUI added to documentElement (<html>)');

        // Make draggable
        makeDraggable(gui);

        // Event listeners
        document.getElementById('close-btn').addEventListener('click', () => {
            gui.style.display = 'none';
        });

        document.getElementById('minimize-btn').addEventListener('click', () => {
            gui.classList.toggle('minimized');
        });

        //document.getElementById('load-template-btn').addEventListener('click', loadTemplate);
        document.getElementById('add-property-btn').addEventListener('click', addProperty);
        document.getElementById('navigate-heap-btn').addEventListener('click', navigateAndApplyHeap);
        document.getElementById('navigate-properties-btn').addEventListener('click', navigateAndApplyProperties);
        document.getElementById('import-json-btn').addEventListener('click', importJSON);
        document.getElementById('clear-properties-btn').addEventListener('click', clearProperties);
        document.getElementById('create-jdbc-provider-btn').addEventListener('click', navigateAndCreateJDBCProvider);
        document.getElementById('create-datasource-btn').addEventListener('click', navigateAndCreateDataSource);
        document.getElementById('load-master-config-btn').addEventListener('click', loadMasterConfigIntoFields);
        console.log('WebSphere Helper: Event listeners attached');
    }

    function loadMasterConfigIntoFields() {
    const jsonInput = document.getElementById('master-config-json').value.trim();

    if (!jsonInput) {
        showStatus('Please enter configuration JSON', 'error');
        return;
    }

    try {
        const config = JSON.parse(jsonInput);

        // Clear properties list first
        properties = [];

        // Fill Server fields
        if (config.server) {
            if (config.server.name) {
                document.getElementById('server-name').value = config.server.name;
            }
            if (config.server.heap) {
                if (config.server.heap.initial) {
                    document.getElementById('initial-heap').value = config.server.heap.initial;
                }
                if (config.server.heap.maximum) {
                    document.getElementById('max-heap').value = config.server.heap.maximum;
                }
            }
        }

        // Fill JDBC Provider fields
        if (config.jdbcProvider) {
            if (config.jdbcProvider.name) {
                document.getElementById('jdbc-provider-name').value = config.jdbcProvider.name;
            }
            if (config.jdbcProvider.implementationClass) {
                document.getElementById('jdbc-impl-class').value = config.jdbcProvider.implementationClass;
            }
            if (config.jdbcProvider.classPath) {
                document.getElementById('jdbc-classpath').value = config.jdbcProvider.classPath;
            }
        }

        // Fill Data Source fields
        if (config.dataSource) {
            if (config.dataSource.name) {
                document.getElementById('ds-name').value = config.dataSource.name;
            }
            if (config.dataSource.jndiName) {
                document.getElementById('ds-jndi').value = config.dataSource.jndiName;
            }
            if (config.dataSource.jdbcProvider) {
                document.getElementById('ds-jdbc-provider').value = config.dataSource.jdbcProvider;
            }

            // Fill Data Source Custom Properties
            if (config.dataSource.customProperties) {
                const props = config.dataSource.customProperties;
                if (props.databaseName) document.getElementById('ds-db-name').value = props.databaseName;
                if (props.serverName) document.getElementById('ds-server-name').value = props.serverName;
                if (props.portNumber) document.getElementById('ds-port').value = props.portNumber;
                if (props.user) document.getElementById('ds-user').value = props.user;
                if (props.password) document.getElementById('ds-password').value = props.password;
                if (props.currentSchema) document.getElementById('ds-schema').value = props.currentSchema;
                if (props.sslmode) document.getElementById('ds-sslmode').value = props.sslmode;
            }
        }

        // Fill JVM Properties list
        if (config.jvmProperties && Array.isArray(config.jvmProperties)) {
            config.jvmProperties.forEach(prop => {
                if (prop.name && prop.value) {
                    properties.push({
                        name: prop.name,
                        value: String(prop.value)
                    });
                }
            });
            updatePropertyList();
        }

        showStatus('Configuration loaded into fields successfully!', 'success');
        logProgress('Master config loaded - all fields populated', 'success');

    } catch (error) {
        showStatus(`Invalid JSON format: ${error.message}`, 'error');
        console.error('JSON Parse Error:', error);
    }
}

// ============================================================================
// UPDATE EVENT LISTENERS - Add the load config button
// ============================================================================



    // Progress logging
    function logProgress(message, type = 'info') {
        const logEl = document.getElementById('progress-log');
        if (!logEl) return;

        logEl.style.display = 'block';
        const timestamp = new Date().toLocaleTimeString();
        const color = type === 'error' ? 'red' : type === 'success' ? 'green' : '#333';
        logEl.innerHTML += `<div style="color: ${color}">[${timestamp}] ${message}</div>`;
        logEl.scrollTop = logEl.scrollHeight;
        console.log(`[WS Helper] ${message}`);
    }

    // Navigate and apply heap settings
    async function navigateAndApplyHeap() {
        if (isProcessing) {
            showStatus('Already processing, please wait...', 'error');
            return;
        }

        const initialHeap = document.getElementById('initial-heap').value;
        const maxHeap = document.getElementById('max-heap').value;
        const serverName = document.getElementById('server-name').value;

        if (!initialHeap || !maxHeap) {
            showStatus('Please enter both heap sizes', 'error');
            return;
        }

        isProcessing = true;
        document.getElementById('navigate-heap-btn').disabled = true;
        document.getElementById('progress-log').innerHTML = '';

        try {
            logProgress('Starting heap configuration...');

            // Navigate to Servers > Server Types > WebSphere application servers
            logProgress('Navigating to WebSphere application servers...');
            await clickNavigationLink('WebSphere application servers');

            logProgress(`Looking for server: ${serverName}`);
            // Click on the server
            await clickServerLink(serverName);

            logProgress('Expanding Java and Process Management...');
            // Navigate to Java and Process Management > Process definition
            await clickLinkInDetailFrame('Process definition');

            logProgress('Opening Java Virtual Machine settings...');
            // Click Java Virtual Machine
            await clickLinkInDetailFrame('Java Virtual Machine');

            logProgress('Setting heap sizes...');
            // Fill in heap sizes
            await setHeapSizes(initialHeap, maxHeap);

            logProgress('Heap configuration completed!', 'success');
            showStatus(`Heap configured: -Xms${initialHeap}m -Xmx${maxHeap}m`, 'success');

        } catch (error) {
            logProgress(`Error: ${error.message}`, 'error');
            showStatus(`Error: ${error.message}`, 'error');
        } finally {
            isProcessing = false;
            document.getElementById('navigate-heap-btn').disabled = false;
        }
    }


    // JSON Import
    function importJSON() {
        const jsonInput = document.getElementById('json-input').value.trim();

        if (!jsonInput) {
            showStatus('Please enter JSON data', 'error');
            return;
        }

        try {
            const jsonData = JSON.parse(jsonInput);

            let importedCount = 0;
            for (const [key, value] of Object.entries(jsonData)) {
                properties.push({
                    name: key,
                    value: String(value)
                });
                importedCount++;
            }

            updatePropertyList();
            showStatus(`Successfully imported ${importedCount} properties from JSON`, 'success');
            document.getElementById('json-input').value = '';

        } catch (error) {
            showStatus(`Invalid JSON format: ${error.message}`, 'error');
            console.error('JSON Parse Error:', error);
        }
    }

    function clearProperties() {
        if (properties.length === 0) {
            showStatus('No properties to clear', 'info');
            return;
        }

        if (confirm(`Are you sure you want to clear all ${properties.length} properties?`)) {
            properties = [];
            updatePropertyList();
            showStatus('All properties cleared', 'info');
        }
    }

    function loadTemplate() {
        const template = document.getElementById('property-template').value;
        if (!template) {
            showStatus('Please select a template', 'error');
            return;
        }

        properties = [...propertyTemplates[template]];
        updatePropertyList();
        showStatus(`Loaded ${properties.length} properties from ${template} template`, 'success');
    }

    function addProperty() {
        const name = document.getElementById('property-name').value.trim();
        const value = document.getElementById('property-value').value.trim();

        if (!name || !value) {
            showStatus('Please enter both property name and value', 'error');
            return;
        }

        properties.push({ name, value });
        updatePropertyList();

        document.getElementById('property-name').value = '';
        document.getElementById('property-value').value = '';

        showStatus('Property added to list', 'success');
    }

    function updatePropertyList() {
        const list = document.getElementById('property-list');
        if (properties.length === 0) {
            list.innerHTML = '<div style="padding: 10px; text-align: center; color: #999; font-size: 11px;">No properties added yet</div>';
            return;
        }
        list.innerHTML = properties.map((prop, idx) => `
            <div class="property-item">
                <span><strong>${escapeHtml(prop.name)}</strong> = ${escapeHtml(prop.value)}</span>
                <button onclick="window.wsHelperRemoveProperty(${idx})">Remove</button>
            </div>
        `).join('');
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Expose this function globally so it can be called from the dynamically created buttons
    window.wsHelperRemoveProperty = function (idx) {
        properties.splice(idx, 1);
        updatePropertyList();
        showStatus('Property removed', 'info');
    };

    function showStatus(message, type) {
        const statusEl = document.getElementById('status-message');
        if (!statusEl) return;

        statusEl.textContent = message;
        statusEl.className = `status-message ${type}`;
        statusEl.style.display = 'block';

        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 5000);
    }

    function makeDraggable(element) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        const header = element.querySelector('.gui-header');

        header.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            element.style.top = (element.offsetTop - pos2) + "px";
            element.style.left = (element.offsetLeft - pos1) + "px";
            element.style.right = 'auto';
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }

    // Initialize GUI - try multiple methods
    function init() {
        console.log('WebSphere Helper: Initializing...');

        // Use a slight delay to ensure the top-level frameset is established
        setTimeout(() => {
            createGUI();
            updatePropertyList(); // Initialize empty list
        }, 1000);
    }

    // Try to initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.addEventListener('load', () => {
        if (!document.getElementById('websphere-helper-gui')) {
            console.log('WebSphere Helper: Retrying GUI creation on window load');
            createGUI();
            updatePropertyList();
        }
    });

})();