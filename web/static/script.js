document.addEventListener('DOMContentLoaded', () => {
    // Tab Navigation
    // Navigation Logic
    const settingsTrigger = document.getElementById('settings-trigger');
    const backToDashboard = document.getElementById('back-to-dashboard');
    const dashboardView = document.getElementById('dashboard');
    const settingsView = document.getElementById('settings');
    const subNavBtns = document.querySelectorAll('.sub-nav-btn');
    const subContents = document.querySelectorAll('.sub-content');

    // Go to Settings
    if (settingsTrigger) {
        settingsTrigger.addEventListener('click', () => {
            dashboardView.classList.remove('active');
            settingsView.classList.add('active');
            // Ensure first tab is active or keep state? Default to calculation on first open
            // Optionally could find currently active sub tab
        });
    }

    // Back to Dashboard
    if (backToDashboard) {
        backToDashboard.addEventListener('click', () => {
            settingsView.classList.remove('active');
            dashboardView.classList.add('active');
        });
    }

    // Sub-tab Navigation (Calculation vs Schedule)
    subNavBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.subtab; // 'calculation' or 'schedule'
            // Deactivate all sub-btns and contents
            subNavBtns.forEach(b => b.classList.remove('active'));
            subContents.forEach(c => c.classList.remove('active'));

            // Activate clicked
            btn.classList.add('active');
            const targetContent = document.getElementById(`sub-${target}`);
            if (targetContent) targetContent.classList.add('active');
        });
    });

    // Initial Load
    fetchStatus();
    fetchConfig();

    // Refresh status every 60s
    setInterval(fetchStatus, 60000);
    // Refresh countdown every 1s
    setInterval(updateCountdown, 1000);

    // Event Listeners
    document.getElementById('save-calc-btn').addEventListener('click', saveCalculationConfig);
    document.getElementById('save-schedule-btn').addEventListener('click', saveScheduleConfig);
    document.getElementById('city-select').addEventListener('change', handleCityChange);
    document.getElementById('country-select').addEventListener('change', handleCountryChange);
});

let countriesData = {}; // Store fetched countries
let cityData = []; // Store current cities for easy access


let nextPrayerTime = null;

// Frontend caching for status data (reduces API calls)
const STATUS_CACHE_TTL = 60000; // 60 seconds - matches polling interval
let statusCache = null;
let statusCacheTime = 0;

async function fetchStatus(forceRefresh = false) {
    // Return cached data if still fresh and not forcing refresh
    const now = Date.now();
    if (!forceRefresh && statusCache && (now - statusCacheTime) < STATUS_CACHE_TTL) {
        console.debug('Using cached status data');
        return;
    }

    try {
        const res = await fetch('/api/status');
        const data = await res.json();

        // Update cache
        statusCache = data;
        statusCacheTime = Date.now();

        // Update Next Prayer
        if (data.next_prayer) {
            document.getElementById('next-prayer-name').textContent = data.next_prayer.name;
            nextPrayerTime = new Date(data.next_prayer.time);

            const timeStr = nextPrayerTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            document.getElementById('next-prayer-time').textContent = `at ${timeStr}`;

            // Hijri Date
            if (data.hijri_date) {
                document.getElementById('hijri-date').textContent = data.hijri_date;
            }
        }

        // Update List
        const listContainer = document.getElementById('prayer-times-list');
        listContainer.innerHTML = '';

        // Prayer icons for dashboard
        // Prayer icons for dashboard (Standardized with Settings)
        const prayerIcons = {
            "Fajr": `<svg viewBox="0 0 24 24" fill="none" stroke="#FDB813" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 18h5"/><path d="M2 18h5"/><path d="M12 18v3"/><path d="M12 14a4 4 0 1 0-8 0"/><path d="M12 10V6"/><path d="M8 8L6 6"/><path d="M16 8l2-2"/></svg>`,
            "Sunrise": `<svg viewBox="0 0 24 24" fill="none" stroke="#FFA726" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/></svg>`,
            "Dhuhr": `<svg viewBox="0 0 24 24" fill="none" stroke="#FFD700" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2"/><path d="M12 21v2"/><path d="M4.22 4.22l1.42 1.42"/><path d="M18.36 18.36l1.42 1.42"/><path d="M1 12h2"/><path d="M21 12h2"/><path d="M4.22 19.78l1.42-1.42"/><path d="M18.36 5.64l1.42-1.42"/></svg>`,
            "Asr": `<svg viewBox="0 0 24 24" fill="none" stroke="#FF9800" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17h-1"/><path d="M5 17h-1"/><path d="M12 12a4 4 0 0 1 8 0"/><path d="M15 9l-1-1"/><path d="M20 9l1-1"/><path d="M17.5 5.5l-.5-.5"/><path d="M12 4v2"/></svg>`,
            "Maghrib": `<svg viewBox="0 0 24 24" fill="none" stroke="#AB47BC" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/><path d="M2 17h20"/><path d="M2 21h20"/></svg>`,
            "Isha": `<svg viewBox="0 0 24 24" fill="none" stroke="#7986CB" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/><path d="M19 3v4"/><path d="M21 5h-4"/></svg>`
        };

        if (data.times) {
            Object.entries(data.times).forEach(([name, timeStr]) => {
                const timeObj = new Date(timeStr);
                const formattedTime = timeObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                const div = document.createElement('div');
                div.className = 'prayer-item';
                if (data.next_prayer && name === data.next_prayer.name) div.classList.add('active');

                const icon = prayerIcons[name] || '';
                div.innerHTML = `
                    <span class="prayer-icon">${icon}</span>
                    <span class="prayer-name">${name}</span>
                    <span class="prayer-time">${formattedTime}</span>
                `;
                listContainer.appendChild(div);
            });
        }

        // --- Astronomy Data Visualization ---
        if (data.astronomy) {
            const astroPanel = document.getElementById('astronomy-data');
            if (astroPanel) {
                // Show panel with CSS class
                astroPanel.classList.add('visible');

                // Moon data
                const illumination = data.astronomy.moon_illumination;
                const phaseName = data.astronomy.nearest_phase.name;

                document.getElementById('moon-phase').textContent = phaseName;
                document.getElementById('moon-illum').textContent = illumination + '%';

                // Update moon image
                const moonImg = document.getElementById('moon-image');
                if (moonImg && data.astronomy.moon_image_index !== undefined) {
                    moonImg.src = `/static/img/moon/${data.astronomy.moon_image_index}.png`;
                }

                // Sun data
                const sunAzimuth = data.astronomy.sun_azimuth;
                const sunAltitude = data.astronomy.sun_altitude;

                document.getElementById('sun-alt').textContent = sunAltitude + '°';
                document.getElementById('sun-az').textContent = sunAzimuth;

                // Rotate sun pointer to azimuth (0° = North)
                const sunPointer = document.getElementById('sun-pointer');
                if (sunPointer) {
                    sunPointer.style.transform = `rotate(${sunAzimuth}deg)`;
                }
            }
        }

        // Update Status Panel
        if (data.devices) {
            window.lastStatusDevices = data.devices; // Store for accordion
            // document.getElementById('device-count').textContent = data.devices.length; // Element removed
            document.getElementById('last-updated').textContent = new Date().toLocaleTimeString();

            // Also update per-prayer device lists
            if (typeof updatePrayerDeviceLists === 'function') {
                updatePrayerDeviceLists();
            }
        }

    } catch (e) {
        console.error("Failed to fetch status", e);
    }
}

async function fetchConfig() {
    try {
        const [configRes, audioRes, citiesRes] = await Promise.all([
            fetch('/api/config'),
            fetch('/api/audio-files'),
            fetch('/api/countries')
        ]);

        const data = await configRes.json();
        const audioData = await audioRes.json();
        countriesData = await citiesRes.json();

        // Handle audio files list
        const athanFiles = Array.isArray(audioData) ? audioData : (audioData.athan || []);
        const reminderFiles = Array.isArray(audioData) ? [] : (audioData.reminders || []);

        // Populate Country Dropdown
        const countrySelect = document.getElementById('country-select');
        countrySelect.innerHTML = ''; // Clear existing

        Object.keys(countriesData).forEach(country => {
            const opt = document.createElement('option');
            opt.value = country;
            opt.textContent = country;
            countrySelect.appendChild(opt);
        });

        // Populate City Dropdown (Initial)
        const citySelect = document.getElementById('city-select');

        // Fill form
        if (data.location) {
            document.getElementById('lat').value = data.location.latitude;
            document.getElementById('lon').value = data.location.longitude;
            document.getElementById('calc-method').value = data.location.calculation_method || 'ISNA';
            document.getElementById('asr-method').value = data.location.asr_method || 'STANDARD';
            document.getElementById('hijri-offset').value = data.location.hijri_offset || 0;
            document.getElementById('timezone').value = data.location.timezone || 'Europe/London';

            // Set High Latitude Rule
            const hlRule = document.getElementById('high-lat-rule');
            if (hlRule) hlRule.value = data.location.high_latitude_rule || 'NONE';

            // Set Country
            // If data has country, use it. Else default to United Kingdom if present, or first key.
            let country = data.location.country || "United Kingdom";
            // Validate country exists in data
            if (!countriesData[country]) {
                country = Object.keys(countriesData)[0];
            }
            countrySelect.value = country;

            // Populate Cities for this country
            updateCityDropdown(country);

            // Set City
            if (data.location.city) {
                citySelect.value = data.location.city;
                // If city is custom, value won't match, so it falls to 'custom' via logic or we explictly handle
                // But wait, updateCityDropdown adds 'custom'.
                // Check if city exists in list
                if (!cityData.find(c => c.name === data.location.city)) {
                    citySelect.value = 'custom';
                }
            } else {
                // Try to match current lat/lon to a city in current country
                const matchingCity = cityData.find(c =>
                    Math.abs(c.lat - data.location.latitude) < 0.001 &&
                    Math.abs(c.lng - data.location.longitude) < 0.001
                );

                if (matchingCity) {
                    citySelect.value = matchingCity.name;
                } else {
                    citySelect.value = 'custom';
                }
            }
        } else {
            // Default init (if no config?)
            const defaultCountry = "United Kingdom";
            if (countriesData[defaultCountry]) {
                countrySelect.value = defaultCountry;
                updateCityDropdown(defaultCountry);
            }
        }

        // Populate Prayers with Sidebar Layout
        const prayerContainer = document.getElementById('prayer-selection');
        if (prayerContainer) {
            // Persist active selection
            const currentActive = document.querySelector('.sidebar-item.active');
            const activePrayer = currentActive ? currentActive.dataset.prayer : "Fajr";

            prayerContainer.innerHTML = '';
            prayerContainer.className = 'schedule-layout'; // Replace checkbox-group class

            // Create Sidebar and Content Areas
            const sidebar = document.createElement('div');
            sidebar.className = 'schedule-sidebar';

            const contentPanel = document.createElement('div');
            contentPanel.className = 'content-panel';

            prayerContainer.appendChild(sidebar);
            prayerContainer.appendChild(contentPanel);

            const prayers = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];
            const icons = {
                "Fajr": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#FFA726;"><path d="M12 9V2"/><path d="M5.6 5.6l1.4 1.4"/><path d="M18.4 5.6l-1.4 1.4"/><path d="M4 12H2"/><path d="M22 12h-2"/><path d="M16 20H8"/><path d="M12 16v4"/></svg>`, // Rising Sun-ish
                "Sunrise": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#FFA726;"><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/></svg>`,
                "Dhuhr": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#FFD700;"><circle cx="12" cy="12" r="5"/><path d="M12 1v2"/><path d="M12 21v2"/><path d="M4.22 4.22l1.42 1.42"/><path d="M18.36 18.36l1.42 1.42"/><path d="M1 12h2"/><path d="M21 12h2"/><path d="M4.22 19.78l1.42-1.42"/><path d="M18.36 5.64l1.42-1.42"/></svg>`, // Full Sun
                "Asr": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#FF9800;"><path d="M12 2v2"/><path d="M12 20v2"/><path d="M4.93 4.93l1.41 1.41"/><path d="M17.66 17.66l1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="M4.93 19.07l1.41-1.41"/><path d="M17.66 6.34l1.41-1.41"/></svg>`, // Sun (slightly different style or same)
                "Maghrib": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#AB47BC;"><path d="M12 20h-6"/><path d="M18 20h-2"/><path d="M5 16h4"/><path d="M15 16h5"/><path d="M12 16v4"/><path d="M16 12a4 4 0 1 0-8 0"/></svg>`, // Sunset/Horizon concept (custom)
                "Isha": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#7986CB;"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/><path d="M19 3v4"/><path d="M21 5h-4"/></svg>` // Moon and Stars
            };

            // Override icons to match the requested style more closely using cleaner paths
            // Fajr: Sun horizon
            icons["Fajr"] = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FDB813" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 18h5"/><path d="M2 18h5"/><path d="M12 18v3"/><path d="M12 14a4 4 0 1 0-8 0"/><path d="M12 10V6"/><path d="M8 8L6 6"/><path d="M16 8l2-2"/></svg>`;
            icons["Sunrise"] = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFA726" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/></svg>`;
            // Dhuhr: Bright Sun
            icons["Dhuhr"] = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFD700" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2"/><path d="M12 21v2"/><path d="M4.22 4.22l1.42 1.42"/><path d="M18.36 18.36l1.42 1.42"/><path d="M1 12h2"/><path d="M21 12h2"/><path d="M4.22 19.78l1.42-1.42"/><path d="M18.36 5.64l1.42-1.42"/></svg>`;
            // Asr: Afternoon Sun (Orange)
            icons["Asr"] = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF9800" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17h-1"/><path d="M5 17h-1"/><path d="M12 12a4 4 0 0 1 8 0"/><path d="M15 9l-1-1"/><path d="M20 9l1-1"/><path d="M17.5 5.5l-.5-.5"/><path d="M12 4v2"/></svg>`;
            // Maghrib: Moon Horizon
            icons["Maghrib"] = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#AB47BC" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/><path d="M2 17h20"/><path d="M2 21h20"/></svg>`;
            // Isha: Moon and Stars
            icons["Isha"] = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7986CB" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/><path d="M19 3v4"/><path d="M21 5h-4"/></svg>`;

            prayers.forEach((p, index) => {
                const isActive = (p === activePrayer);
                let conf = data.prayers ? data.prayers[p] : true;
                // Normalize config
                if (typeof conf === 'boolean') {
                    conf = { athan_enabled: conf };
                } else if (!conf) {
                    conf = { athan_enabled: true };
                }

                // Defaults
                conf.athan_audio_file = conf.athan_audio_file || "";
                conf.athan_volume = conf.athan_volume !== null && conf.athan_volume !== undefined ? conf.athan_volume : 0.5;
                conf.reminder_offset = conf.reminder_offset || 0;
                conf.reminder_timing = conf.reminder_timing || "before";
                conf.reminder_audio_file = conf.reminder_audio_file || "";
                conf.reminder_volume = conf.reminder_volume !== null && conf.reminder_volume !== undefined ? conf.reminder_volume : 0.3;
                conf.athan_offset = conf.athan_offset || 0;
                conf.athan_timing = conf.athan_timing || "before";

                // --- Sidebar Item ---
                const sidebarItem = document.createElement('div');
                sidebarItem.className = `sidebar-item ${isActive ? 'active' : ''}`;
                sidebarItem.dataset.prayer = p;
                sidebarItem.onclick = (e) => {
                    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'LABEL') {
                        setActivePrayer(p);
                    }
                };

                sidebarItem.innerHTML = `
                    <div class="sidebar-icon">${icons[p]}</div>
                    <div class="sidebar-name">${p}</div>
                `;
                sidebar.appendChild(sidebarItem);

                // --- Detail View ---
                const detailView = document.createElement('div');
                detailView.className = `prayer-detail-view ${isActive ? 'active' : ''}`;
                detailView.id = `detail-${p}`;

                // Header removed to reduce redundancy
                /*
                const detailHeader = document.createElement('div');
                detailHeader.className = 'detail-header';
                detailHeader.innerHTML = `
                    <h3>${icons[p]} ${p}</h3>
                `;
                detailView.appendChild(detailHeader);
                */

                // Hidden inner enable needed for save logic? 
                // Currently save logic looks for `prayer-${p}-enable-inner`.
                // We can sync the sidebar toggle to a hidden checkbox OR update save logic.
                // EASIER: Update save logic later or alias it. 
                // ACTUALLY: The User Request is to have the master toggle in sidebar. 
                // Let's rely on `prayer-${p}-enable` (Sidebar) as the source of truth?
                // The existing code uses `prayer-${p}-enable-inner`. 
                // Let's add a hidden input with that ID to keep compatibility or just update save function.
                // Let's keep `prayer-${p}-enable-inner` as a hidden field synced with sidebar for safety.

                // Removed duplicate hidden input creation since we are putting it back in the header
                // const hiddenSync = document.createElement('input'); ...


                // Audio Options
                // Audio Options (Athan)
                let audioOpts = `<option value="">-- Select Athan --</option>`;
                athanFiles.forEach(f => {
                    const sel = (conf.athan_audio_file === f) ? 'selected' : '';
                    audioOpts += `<option value="${f}" ${sel}>${f}</option>`;
                });

                // Audio Options (Reminder)
                let remAudioOpts = `<option value="">-- Select Reminder --</option>`;
                reminderFiles.forEach(f => {
                    const sel = (conf.reminder_audio_file === f) ? 'selected' : '';
                    remAudioOpts += `<option value="${f}" ${sel}>${f}</option>`;
                });

                // Content Body (Cards)

                // --- ATHAN SETTINGS ---
                const athanSection = `
                <div class="inner-card" style="${p === 'Sunrise' ? 'display:none;' : ''}">
                    <div class="inner-card-header">
                        <h4>Athan Settings</h4>
                        <div class="header-controls">
                            <div class="btn-pill-group" id="athan-pill-${p}" style="display: ${conf.athan_enabled !== false ? 'flex' : 'none'}">
                                <button class="header-btn test" id="btn-athan-test-${p}" onclick="testAthan('${p}')">${ICON_PLAY} Test</button>
                                <span class="btn-pill-divider"></span>
                                <button class="header-btn stop" id="btn-athan-stop-${p}" onclick="stopAudio('${p}')">${ICON_STOP} Stop</button>
                            </div>
                            <div class="header-toggle">
                                <label>Enable</label>
                                <label class="switch">
                                    <input type="checkbox" id="prayer-${p}-enable-inner" ${conf.athan_enabled !== false ? 'checked' : ''} onchange="toggleMasterEnable('${p}', this.checked)">
                                    <span class="slider round"></span>
                                </label>
                            </div>
                        </div>
                    </div>
                    <div class="inner-card-body" id="prayer-${p}-athan-body" style="display: ${conf.athan_enabled !== false ? 'block' : 'none'}">

                        <div class="settings-grid">
                            <!-- Column 1: Audio -->
                            <div class="settings-col">
                                <label>Audio</label>
                                <select id="prayer-${p}-audio">${audioOpts}</select>
                            </div>
                            <!-- Column 2: Timing -->
                            <div class="settings-col">
                                <label>Timing</label>
                                <select id="prayer-${p}-athan-timing">
                                    <option value="before" ${conf.athan_timing === 'before' ? 'selected' : ''}>Before</option>
                                    <option value="after" ${conf.athan_timing === 'after' ? 'selected' : ''}>After</option>
                                </select>
                            </div>
                            <!-- Column 3: Minutes -->
                            <div class="settings-col">
                                <label>Minutes</label>
                                <input type="number" id="prayer-${p}-athan-offset" min="0" max="60" value="${conf.athan_offset || 0}">
                            </div>
                            <!-- Column 4: Volume -->
                            <div class="settings-col">
                                <label>Volume <span id="prayer-${p}-athan-vol-disp" style="font-size:0.8em; color:#bbb;">${Math.round(conf.athan_volume * 100)}%</span></label>
                                <input type="range" id="prayer-${p}-athan-vol" min="0.1" max="1" step="0.1" value="${conf.athan_volume}" oninput="document.getElementById('prayer-${p}-athan-vol-disp').innerText = Math.round(this.value * 100) + '%'">
                            </div>
                        </div>
                    </div>
                </div>`;

                // --- REMINDER SETTINGS ---
                const reminderSection = `
                <div class="inner-card">
                    <div class="inner-card-header">
                        <h4>Reminder Settings</h4>
                        <div class="header-controls">
                            <div class="btn-pill-group" id="rem-pill-${p}" style="display: ${conf.reminder_enabled ? 'flex' : 'none'}">
                                <button class="header-btn test" id="btn-rem-test-${p}" onclick="testReminder('${p}')">${ICON_PLAY} Test</button>
                                <span class="btn-pill-divider"></span>
                                <button class="header-btn stop" id="btn-rem-stop-${p}" onclick="stopAudio('${p}')">${ICON_STOP} Stop</button>
                            </div>
                            <div class="header-toggle">
                                <label>Enable</label>
                                <label class="switch">
                                    <input type="checkbox" id="prayer-${p}-rem-enable" ${conf.reminder_enabled ? 'checked' : ''} onchange="toggleReminderFields('${p}')">
                                    <span class="slider round"></span>
                                </label>
                            </div>
                        </div>
                    </div>
                    
                    <div class="inner-card-body" id="prayer-${p}-rem-fields" style="display: ${conf.reminder_enabled ? 'block' : 'none'}">
                        <div class="settings-grid">
                            <!-- Column 1: Audio -->
                            <div class="settings-col">
                                <label>Audio</label>
                                <select id="prayer-${p}-rem-audio">${remAudioOpts}</select>
                            </div>
                            <!-- Column 2: Timing -->
                            <div class="settings-col">
                                <label>Timing</label>
                                <select id="prayer-${p}-rem-timing">
                                    <option value="before" ${conf.reminder_timing === 'before' ? 'selected' : ''}>Before</option>
                                    <option value="after" ${conf.reminder_timing === 'after' ? 'selected' : ''}>After</option>
                                </select>
                            </div>
                            <!-- Column 3: Minutes -->
                            <div class="settings-col">
                                <label>Minutes</label>
                                <input type="number" id="prayer-${p}-rem-offset" min="0" max="60" value="${conf.reminder_offset || 0}">
                            </div>
                            <!-- Column 4: Volume -->
                            <div class="settings-col">
                                <label>Volume <span id="prayer-${p}-rem-vol-disp" style="font-size:0.8em; color:#bbb;">${Math.round(conf.reminder_volume * 100)}%</span></label>
                                <input type="range" id="prayer-${p}-rem-vol" min="0.1" max="1" step="0.1" value="${conf.reminder_volume}" oninput="document.getElementById('prayer-${p}-rem-vol-disp').innerText = Math.round(this.value * 100) + '%'">
                            </div>
                        </div>
                    </div>
                </div>`;

                // --- DEVICES CARD ---
                const deviceSection = `
                <div class="inner-card">
                    <div class="inner-card-header">
                         <h4>Target Speakers</h4>
                    </div>
                    <div class="inner-card-body" style="display:block;">
                        <div id="prayer-${p}-dev-list" class="checkbox-group">
                            <!-- Populated dynamically -->
                        </div>
                    </div>
                </div>
                `;

                detailView.innerHTML += athanSection + reminderSection + deviceSection;
                contentPanel.appendChild(detailView);

            });

            // Store config for later reference in updatePrayerDeviceLists
            window.prayerConfigData = data.prayers;

            // Initial population if we have data, otherwise fetchStatus will handle it
            if (window.lastStatusDevices) {
                updatePrayerDeviceLists();
            }
        }

    } catch (e) {
        console.error(e);
    }
}

// function syncEnable(prayer) - Removed as legacy accordion logic

function toggleReminderFields(prayer) {
    const isEnabled = document.getElementById(`prayer-${prayer}-rem-enable`).checked;
    const fields = document.getElementById(`prayer-${prayer}-rem-fields`);
    const pillGroup = document.getElementById(`rem-pill-${prayer}`);

    if (fields) fields.style.display = isEnabled ? 'block' : 'none';
    if (pillGroup) pillGroup.style.display = isEnabled ? 'flex' : 'none';
}

function updatePrayerDeviceLists() {
    const prayers = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];
    const devices = window.lastStatusDevices || [];
    const config = window.prayerConfigData || {};

    prayers.forEach(p => {
        const container = document.getElementById(`prayer-${p}-dev-list`);
        if (!container) return;

        // Clear and rebuild the device list for the prayer
        container.innerHTML = '';

        const prayerConf = config[p];
        let confDevices = (prayerConf && typeof prayerConf === 'object') ? prayerConf.enabled_devices : [];

        devices.forEach(d => {
            let isChecked = false;
            if (confDevices && confDevices.includes(d.uuid)) {
                isChecked = true;
            }

            const div = document.createElement('div');
            div.className = 'checkbox-item';
            div.innerHTML = `
                 <span class="device-name">${d.name}</span>
                 <label class="switch">
                    <input type="checkbox" class="p-dev-cb" data-prayer="${p}" value="${d.uuid}" ${isChecked ? 'checked' : ''}>
                    <span class="slider round"></span>
                 </label>
             `;
            container.appendChild(div);
        });
    });
}

// SVG Icons
const ICON_PLAY = `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
const ICON_STOP = `<svg viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>`;

// Global state
let currentConfig = {};

async function saveCalculationConfig() {
    // We need to fetch current config first to avoid overwriting schedule if we only send partial
    // OR we just send what we have in this tab. 
    // The API updates iteratively on the dict, so sending partial "location" is fine, 
    // BUT "prayers" are separate. 
    // Ideally we'd have separate endpoints, but here we can just construct partial update.

    const configData = {
        location: {
            latitude: parseFloat(__e('lat').value),
            longitude: parseFloat(__e('lon').value),
            calculation_method: __e('calc-method').value,
            asr_method: __e('asr-method').value,
            hijri_offset: parseInt(__e('hijri-offset').value),
            timezone: __e('timezone').value,
            high_latitude_rule: __e('high-lat-rule').value,
            country: __e('country-select').value,
            city: __e('city-select').value !== 'custom' ? __e('city-select').value : null
        }
        // No audio/prayers/devices data sent, so config manager should match & update just location
    };

    await sendConfig(configData, "Calculation Settings Saved!");
}

async function saveScheduleConfig() {
    // Gather prayers
    const prayers = {};
    ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"].forEach(p => {
        // Use the actual element ID that exists in the DOM
        const enableCb = document.getElementById(`prayer-${p}-enable-inner`);
        if (enableCb) {
            const devList = [];
            document.querySelectorAll(`.p-dev-cb[data-prayer="${p}"]:checked`).forEach(cb => devList.push(cb.value));

            prayers[p] = {
                athan_enabled: enableCb.checked,
                athan_audio_file: document.getElementById(`prayer-${p}-audio`).value || null,
                athan_volume: parseFloat(document.getElementById(`prayer-${p}-athan-vol`).value),
                athan_timing: document.getElementById(`prayer-${p}-athan-timing`).value,
                athan_offset: parseInt(document.getElementById(`prayer-${p}-athan-offset`).value) || 0,
                reminder_enabled: document.getElementById(`prayer-${p}-rem-enable`).checked,
                reminder_timing: document.getElementById(`prayer-${p}-rem-timing`).value,
                reminder_offset: parseInt(document.getElementById(`prayer-${p}-rem-offset`).value) || 0,
                reminder_audio_file: document.getElementById(`prayer-${p}-rem-audio`).value || null,
                reminder_volume: parseFloat(document.getElementById(`prayer-${p}-rem-vol`).value),
                enabled_devices: devList
            };
        }
    });

    const configData = {
        prayers: prayers
    };

    await sendConfig(configData, "Schedule Settings Saved!");
}

async function sendConfig(data, successMsg) {
    const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    if (res.ok) {
        showToast(successMsg, 'success');
        // Clear frontend cache since config changed
        statusCache = null;
        statusCacheTime = 0;
        await fetchConfig();  // Wait for config + UI rebuild first
        await fetchStatus(true);  // Force refresh - bypass cache
    } else {
        showToast("Error saving configuration", 'error');
    }
}

function updateCountdown() {
    if (!nextPrayerTime) return;

    const now = new Date();
    const diff = nextPrayerTime - now;

    if (diff <= 0) {
        document.getElementById('countdown').textContent = "00:00:00";
        return;
    }

    const h = Math.floor(diff / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((diff / 1000) % 60);

    document.getElementById('countdown').textContent =
        `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// Helpers
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);

    // Remove after 3s
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

async function testAthan(prayer) {
    // Gather current form data for that prayer to test WHAT IS SET currently
    const vol = parseFloat(document.getElementById(`prayer-${prayer}-athan-vol`).value);
    const audio = document.getElementById(`prayer-${prayer}-audio`).value || null;

    // Devices
    let devices = [];
    document.querySelectorAll(`.p-dev-cb[data-prayer="${prayer}"]:checked`).forEach(cb => devices.push(cb.value));

    const data = {
        prayer_name: prayer,
        athan_audio_file: audio,
        volume: vol,
        target_devices: devices
    };

    showToast(`Triggering Athan for ${prayer}...`, 'info');

    try {
        const res = await fetch('/api/test-play', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const json = await res.json();
        if (res.ok) showToast(json.message, 'success');
        else showToast("Error: " + json.detail, 'error');
    } catch (e) {
        showToast("Network Error", 'error');
    }
}

async function testReminder(prayer) {
    const vol = parseFloat(document.getElementById(`prayer-${prayer}-rem-vol`).value);
    const offset = parseInt(document.getElementById(`prayer-${prayer}-rem-offset`).value) || 0;
    const audio = document.getElementById(`prayer-${prayer}-rem-audio`).value;
    const timing = document.getElementById(`prayer-${prayer}-rem-timing`).value;

    // Devices
    let devices = [];
    document.querySelectorAll(`.p-dev-cb[data-prayer="${prayer}"]:checked`).forEach(cb => devices.push(cb.value));

    const data = {
        prayer_name: prayer,
        minutes: offset,
        volume: vol,
        reminder_audio_file: audio,
        timing: timing,
        target_devices: devices
    };

    showToast(`Triggering Reminder for ${prayer}...`, 'info');

    try {
        const res = await fetch('/api/test-reminder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const json = await res.json();
        if (res.ok) showToast(json.message, 'success');
        else showToast("Error: " + json.detail, 'error');
    } catch (e) {
        showToast("Network Error", 'error');
    }
}

function setActivePrayer(prayer) {
    // Update Sidebar
    document.querySelectorAll('.sidebar-item').forEach(item => {
        if (item.dataset.prayer === prayer) item.classList.add('active');
        else item.classList.remove('active');
    });

    // Update Detail View
    document.querySelectorAll('.prayer-detail-view').forEach(view => {
        view.classList.remove('active');
    });
    const target = document.getElementById(`detail-${prayer}`);
    if (target) {
        target.classList.add('active');
        // Re-initialize lists if needed, but they are already in DOM
    }
}

function toggleMasterEnable(prayer, isEnabled) {
    // 1. Sync Sidebar Toggle (Removed as sidebar toggle is gone)
    // const sidebarToggle = document.getElementById(`prayer-${prayer}-enable`);
    // if (sidebarToggle && sidebarToggle.checked !== isEnabled) {
    //     sidebarToggle.checked = isEnabled;
    // }

    // 2. Sync Inner Athan Toggle
    const innerToggle = document.getElementById(`prayer-${prayer}-enable-inner`);
    if (innerToggle && innerToggle.checked !== isEnabled) {
        innerToggle.checked = isEnabled;
    }

    // 3. Toggle Visibility of Athan Body and Pill Group
    const athanBody = document.getElementById(`prayer-${prayer}-athan-body`);
    const pillGroup = document.getElementById(`athan-pill-${prayer}`);

    if (athanBody) athanBody.style.display = isEnabled ? 'block' : 'none';
    if (pillGroup) pillGroup.style.display = isEnabled ? 'flex' : 'none';
}

function handleCountryChange() {
    const country = document.getElementById('country-select').value;
    updateCityDropdown(country);

    // Select first city by default and update lat/lon
    if (cityData.length > 0) {
        const citySelect = document.getElementById('city-select');
        citySelect.selectedIndex = 1; // 0 is custom, 1 is first city
        handleCityChange();
    }
}

function updateCityDropdown(country) {
    const cities = countriesData[country] || [];
    cityData = cities; // Update global

    const citySelect = document.getElementById('city-select');
    citySelect.innerHTML = '<option value="custom">Custom Location</option>';

    cities.forEach(city => {
        const opt = document.createElement('option');
        opt.value = city.name;
        opt.textContent = city.name;
        opt.dataset.lat = city.lat;
        opt.dataset.lng = city.lng;
        citySelect.appendChild(opt);
    });
}

function handleCityChange() {
    const citySelect = document.getElementById('city-select');
    const selectedOption = citySelect.options[citySelect.selectedIndex];

    if (selectedOption.value !== 'custom') {
        const lat = selectedOption.dataset.lat;
        const lng = selectedOption.dataset.lng;

        if (lat && lng) {
            document.getElementById('lat').value = lat;
            document.getElementById('lon').value = lng;
        }
    }
}

function __e(id) {
    return document.getElementById(id);
}

async function stopAudio(prayer) {
    // Collect target devices for this prayer (same as test uses)
    let devices = [];
    if (prayer) {
        document.querySelectorAll(`.p-dev-cb[data-prayer="${prayer}"]:checked`).forEach(cb => devices.push(cb.value));
    }

    const deviceCount = devices.length;
    showToast(`Stopping audio on ${deviceCount > 0 ? deviceCount + ' device(s)' : 'all devices'}...`, 'info');

    try {
        const res = await fetch('/api/stop-audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target_devices: devices.length > 0 ? devices : null })
        });
        const json = await res.json();
        if (res.ok) {
            showToast("AUDIO STOPPED", 'error'); // Use error style for red visibility
        } else {
            showToast("Error stopping audio", 'error');
        }
    } catch (e) {
        console.error(e);
        showToast("Network Error", 'error');
    }
}
