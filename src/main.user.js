// ==UserScript==
// @name         roar Overtime Tracker
// @namespace    https://pixelpark.com/
// @version      0.1.6
// @description  try to take over the world!
// @author       You
// @match        https://timesheet.roar.pub/*
// @match        https://timesheet-singleorg.roar.pub/*
// @grant        none
// ==/UserScript==


const STORAGE_KEY = 'OVERTIME_TRACKER';
const STORAGE_VERSION = 1;
const LOG_LEVEL = 0; // info=0, debug=1
let currentWeekKey;
let applicationLoading = true;

(function(open) {
    XMLHttpRequest.prototype.open = function() {
        this.addEventListener('loadend', function() {
            const url = this.responseURL;
            if (url.includes('/search?')) {
                const response = JSON.parse(this.response);
                const urlParams = new URLSearchParams(url);
                const startDate = urlParams.get('DateFrom');
                const endDate = urlParams.get('DateTo');
                const weekKey = `${startDate}:${endDate}`;
                if (response.success && typeof response.value === 'object' && typeof response.value.timesheets === 'object') {
                    handeNewData(weekKey, mapEntries(response.value.timesheets));
                }
            }
        }, false);
        open.apply(this, arguments);
    };
})(XMLHttpRequest.prototype.open);

// wait for application to load
const waitingInterval = setInterval(() => {
    logInfo('waiting for application to load...');
    if (document.querySelector('.sticky-header') !== null) {
        clearInterval(waitingInterval);
        applicationLoading = false;
        initDataDisplay();
    }
}, 1000);


let storage = {
    version: STORAGE_VERSION,
    entries: {},
    target: 40
};

const fromLocalStorage = localStorage.getItem(STORAGE_KEY);

if (fromLocalStorage) {
    storage = upgradeStorage(JSON.parse(fromLocalStorage));
}

function setWorkedHours(weekKey, entries) {
    const hours = calculateHours(entries);
    const nonWorkingTime = calculateNonWorkingTime(entries);
    const weekEntry = storage.entries[weekKey];
    if (weekEntry) {
        weekEntry.worked = hours;
        weekEntry.modifiers.automatic = nonWorkingTime;
        weekEntry.entries = entries;
    } else {
        storage.entries[weekKey] = {
            id: weekKey,
            worked: hours,
            modifiers: {
                manual: 0,
                automatic: nonWorkingTime
            },
            target: storage.target,
            entries,
        };
    }
    logDebug(storage.entries[weekKey]);
}

function calculateHours(entries) {
    return round(entries.reduce(
        (accumulator, entry) => accumulator + entry.value,
        0
    ));
}

function calculateNonWorkingTime(entries) {
    return 0;
}

function mapEntries(entries) {
    return entries
        .filter(entry => entry.durationValue > 0)
        .map(entry => {
        return {
            value: entry.durationValue,
            jobCode: entry.job_ID,
            workCode: entry.workCodeName,
            date: entry.reportedDate.split('T')[0],
            comment: entry.comment,
        };
    });
}

function handleTargetHoursClick() {
    if (currentWeekKey) {
        const newTarget = prompt('New current week target:', storage.entries[currentWeekKey].target);
        if (newTarget) {
            const newTargetFloat = round(parseFloat(newTarget));
            if (!isNaN(newTargetFloat)) {
                setTargetHours(currentWeekKey, newTargetFloat);
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
            target: storage.target,
            entries: [],
        }
    }
    updateData(weekKey);
}

function setOverallTargetHours(hours) {
    storage.target = hours;
    updateData(currentWeekKey);
}

function handeNewData(weekKey, entries) {
    const isWeekEmpty = entries.length < 1;
    if (isWeekEmpty) {
        currentWeekKey = undefined;
        delete storage.entries[weekKey];
        logInfo(weekKey, 'empty week');
    } else {
        currentWeekKey = weekKey;
        setWorkedHours(weekKey, entries);
    }
    updateData(weekKey);
}

function updateData(weekKey) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
    const currentWeek = storage.entries[weekKey];
    if (applicationLoading) {
        return;
    }
    if (currentWeek) {
        const currentWorked = currentWeek.worked - currentWeek.modifiers.automatic - currentWeek.modifiers.manual;
        const currentWorkedTitle = `${currentWeek.worked} - ${currentWeek.modifiers.automatic} + ${currentWeek.modifiers.manual}`;
        document.querySelector('.js--week-worked').innerText = round(currentWorked);
        document.querySelector('.js--week-worked').title = currentWorkedTitle;
        document.querySelector('.js--week-overtime').innerText = round(currentWorked - currentWeek.target);
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
    document.querySelector('.js--overall-worked').innerText = round(overallWorked);
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
<div style="display: flex;flex-direction: column;justify-content: space-between;">
  <div>
    <i role="button" title="Export" style="cursor: pointer;font-size: 1.25rem;" class="v-icon notranslate mdi mdi-download theme--light primary--text js--export-button"></i>
    <i role="button" title="Import" style="cursor: pointer;font-size: 1.25rem;" class="v-icon notranslate mdi mdi-upload theme--light primary--text js--import-button"></i>
  </div>
  <span style="font-size: 0.75rem;text-align: right;">v${GM_info.script.version}</span>
</div>
    `;
    document.querySelector('body').appendChild(element);
    document.querySelector('.js--week-target').addEventListener('click', handleTargetHoursClick);
    document.querySelector('.js--overall-target').addEventListener('click', handleOverallTargetHoursClick);
    document.querySelector('.js--export-button').addEventListener('click', handleExportClick);
    document.querySelector('.js--import-button').addEventListener('click', handleImportClick);
    updateData(currentWeekKey);
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
                        throw 'Restore: No data attribute available.';
                    }
                    storage = upgradeStorage(result.data);
                    updateData(currentWeekKey);
                    logInfo('Successfully imported.');
                } catch (e) {
                    logError(e);
                }
            };
            fr.readAsText(file);
        }
        inputElement.remove();
    });
}

function upgradeStorage(storage) {
    if (storage.version === STORAGE_VERSION) {
        return storage;
    }
    logInfo(`Old storage version detected: ${storage.version}`);
    if (storage.version === 0) {
        logInfo(`Upgrading storage to version 1...`);
        const entries = {};
        for (const entity of Object.values(storage.entries)) {
            // '05/12/2022 - 11/12/2022' -> '2022-12-05:2022-12-11'
            logDebug('old id', entity.id);
            const id = entity.id
                .split(' - ')
                .map(date => date.split('/').reverse().join('-'))
                .join(':');
            logDebug('new id', id);
            entries[id] = {
                id,
                worked: entity.worked,
                modifiers: {
                    manual: entity.modifiers.manual,
                    automatic: entity.modifiers.automatic,
                },
                target: entity.target,
                entries: [],
            }
        }
        logInfo(`Upgrade to version 1 completed.`);
        logDebug('entries', entries);
        return upgradeStorage({
            version: 1,
            entries,
            target: storage.target,
        });
    }
    logInfo('Incompatible storage version...');
}

function round(number) {
    return Math.round(number * 10) / 10;
}

function logInfo(...messages) {
    console.info('roar-overtime-tracker:', ...messages);
}

function logError(...messages) {
    console.error('roar-overtime-tracker:', ...messages);
}

function logDebug(...messages) {
    if (LOG_LEVEL > 0) {
        console.debug('roar-overtime-tracker:', ...messages);
    }
}
