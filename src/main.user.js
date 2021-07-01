// ==UserScript==
// @name         roar Overtime Tracker
// @namespace    https://pixelpark.com/
// @version      0.1.2
// @description  try to take over the world!
// @author       You
// @match        https://timesheet.roar.pub/*
// @grant        none
// ==/UserScript==


const STORAGE_KEY = 'OVERTIME_TRACKER';

// wait for application to load
const waitingInverval = setInterval(() => {
    console.log('waiting for application to load...');
    const weekInput = document.querySelector('.sticky-header').querySelector('input');
    if (weekInput !== null) {
        setUpChangeListener();
        const weekKey = weekInput.value;
        console.log(weekKey);
        clearInterval(waitingInverval);
        initDataDisplay();
    }
}, 1000);


let storage = {
    version: 0,
    entries: {},
    target: 40
};

const fromLocalStorage = localStorage.getItem(STORAGE_KEY);

if (fromLocalStorage) {
    storage = JSON.parse(fromLocalStorage);
}

function setWorkedHours(weekKey, hours) {
    if (storage.entries[weekKey]) {
        storage.entries[weekKey].worked = hours
    } else {
        storage.entries[weekKey] = {
            id: weekKey,
            worked: hours,
            modifiers: {
                manual: 0,
                automatic: 0
            },
            target: storage.target
        }
    }
    updateData();
}

function handleTargetHoursClick() {
    const currentWeek = getCurrentWeek();
    if (currentWeek) {
        const newTarget = prompt('New current week target:', currentWeek.target);
        if (newTarget) {
            const newTargetFloat = round(parseFloat(newTarget));
            if (!isNaN(newTargetFloat)) {
                setTargetHours(getCurrentWeekKey(), newTargetFloat);
            }
        }
    }
}

function handleOverallTargetHoursClick() {
    const newTarget = prompt('New overall target:', storage.target);
    if (newTarget) {
        const newTargetFloat = round(parseFloat(newTarget));
        if (!isNaN(newTargetFloat)) {
            setOverallTargetHours(newTargetFloat);
        }
    }
}

function setTargetHours(weekKey, hours) {
    if (storage.entries[weekKey]) {
        storage.entries[weekKey].target = hours;
    } else {
        storage.entries[weekKey] = {
            id: weekKey,
            worked: 0,
            modifiers: {
                manual: 0,
                automatic: 0
            },
            target: storage.target
        }
    }
    updateData();
}

function setOverallTargetHours(hours) {
    storage.target = hours;
    updateData();
}

function handleChange() {
    const weekKey = getCurrentWeekKey();
    const currentWeekDayTotals = document.querySelectorAll('.job-day-total-duration');
    const isWeekEmpty = currentWeekDayTotals.length < 1;
    if (isWeekEmpty) {
        delete storage.entries[weekKey];
        updateData();
        console.log(weekKey, 'empty week');
    } else {
        const total = parseFloat(currentWeekDayTotals[currentWeekDayTotals.length - 1].innerText);
        setWorkedHours(weekKey, total);
        console.log(weekKey, total);
    }
}

function getCurrentWeekKey() {
    return document.querySelector('.sticky-header').querySelector('input').value;
}

function getCurrentWeek() {
    return storage.entries[getCurrentWeekKey()];
}

function setUpChangeListener() {
    // https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver
    const targetNode = document.querySelector('.v-application--wrap');
    const config = { attributes: false, childList: true, subtree: true };
    const callback = (mutationsList, observer) => {
        for (const mutation of mutationsList) {
            if (mutation.removedNodes.length > 0) {
                const isLoaderRemovedMutation = mutation.removedNodes[0].classList && mutation.removedNodes[0].classList.contains('timesheet-loader');
                if (isLoaderRemovedMutation) {
                    /* TODO find better solution than setTimeout
                     * there should be some way to detect the moment when the numbers (displayed to the user) are adjusted.
                     * it seems like it is not possible to detect innerText changes, even if, it wouldn't be the only indicator something has changed
                     */
                    setTimeout(handleChange, 250);
                }
            }
        }
    };
    const observer = new MutationObserver(callback);
    observer.observe(targetNode, config);
    console.log('mutation observer active.');
}

function updateData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
    const currentWeek = getCurrentWeek();
    if (currentWeek) {
        const currentWorked = currentWeek.worked - currentWeek.modifiers.automatic - currentWeek.modifiers.manual;
        const currentWorkedTitle = `${currentWeek.worked} - ${currentWeek.modifiers.automatic} + ${currentWeek.modifiers.manual}`;
        document.querySelector('.js--week-worked').innerText = currentWorked;
        document.querySelector('.js--week-worked').title = currentWorkedTitle;
        document.querySelector('.js--week-overtime').innerText = currentWorked - currentWeek.target;
        document.querySelector('.js--week-target').innerText = currentWeek.target;
    } else {
        document.querySelector('.js--week-worked').innerText = 0;
        document.querySelector('.js--week-overtime').innerText = 0;
        document.querySelector('.js--week-target').innerText = storage.target;
    }
    let overallWorked = 0;
    let overallOvertime = 0;
    for (const week of Object.values(storage.entries)) {
        const worked = week.worked - week.modifiers.manual - week.modifiers.automatic;
        const overtime = worked - week.target;
        overallWorked += worked;
        overallOvertime += overtime;
    }
    document.querySelector('.js--overall-worked').innerText = overallWorked;
    document.querySelector('.js--overall-overtime').innerText = round(overallOvertime);
    document.querySelector('.js--overall-target').innerText = storage.target;
}

function initDataDisplay() {
    const element = document.createElement('div');
    element.style = 'position: absolute; top: 1rem; right: 0; font-family: sans-serif; z-index: 100; display: flex;';
    element.innerHTML = `
<div>
  <b>This week:</b>
  <div style="display: grid; grid-template-columns: 1fr 1fr; column-gap: 0.5rem; margin-right: 1rem;">
    <span>worked:</span><span class="js--week-worked">0</span>
    <span>overtime:</span><span class="js--week-overtime">0</span>
    <span>target:</span><span class="js--week-target" title="edit" style="cursor: pointer;">40</span>
  </div>
</div>
<div>
  <b>Overall:</b>
  <div style="display: grid; grid-template-columns: 1fr 1fr; column-gap: 0.5rem;">
    <span>worked:</span><span class="js--overall-worked">0</span>
    <span>overtime:</span><span class="js--overall-overtime">0</span>
    <span>target:</span><span class="js--overall-target" title="edit" style="cursor: pointer;">40</span>
  </div>
</div>
<div>
  <i aria-label="Export" role="button" title="Export" style="cursor: pointer;font-size: 1.25rem;" class="v-icon notranslate mdi mdi-download theme--light primary--text js--export-button"></i>
  <i aria-label="Import" role="button" title="Import" style="cursor: pointer;font-size: 1.25rem;" class="v-icon notranslate mdi mdi-upload theme--light primary--text js--import-button"></i>
</div>
    `;
    document.querySelector('body').appendChild(element);
    document.querySelector('.js--week-target').addEventListener('click', handleTargetHoursClick);
    document.querySelector('.js--overall-target').addEventListener('click', handleOverallTargetHoursClick);
    document.querySelector('.js--export-button').addEventListener('click', handleExportClick);
    document.querySelector('.js--import-button').addEventListener('click', handleImportClick);
    updateData();
}

function handleExportClick() {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify({ data: storage }));
    const downloadElement = document.createElement('a');
    downloadElement.setAttribute('href', dataStr);
    const exportName = 'Export_' + new Date().toISOString().split('T')[0] + '.roarOvertimeTracker';
    downloadElement.setAttribute('download', exportName);
    downloadElement.click();
    downloadElement.remove();
}

function handleImportClick() {
    const inputElement = document.createElement('input');
    inputElement.setAttribute('type', 'file');
    inputElement.setAttribute('accept', '.roarOvertimeTracker');
    inputElement.setAttribute('multiple', 'false');
    inputElement.click();
    inputElement.addEventListener('change', () => {
        const file = inputElement.files[0];
        if (file !== undefined) {
            const fr = new FileReader();
            fr.onload = () => {
                try {
                    const result = JSON.parse(fr.result);
                    if (!result.data) {
                        console.error('Restore: No data attribute available.');
                    }
                    storage = result.data;
                    updateData();
                    console.info('Erfolgreich importiert.');
                } catch (e) {
                    console.error(e);
                }
            };
            fr.readAsText(file);
        }
        inputElement.remove();
    });
}

function round(number) {
    return Math.round(number * 10) / 10;
}
