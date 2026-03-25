// script.js
// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBNsJQZgS1J2d0oFhHAA1MR3nmmvCtJ-ME",
    authDomain: "pharmaconnect-e89fa.firebaseapp.com",
    databaseURL: "https://pharmaconnect-e89fa-default-rtdb.firebaseio.com",
    projectId: "pharmaconnect-e89fa",
    storageBucket: "pharmaconnect-e89fa.firebasestorage.app",
    messagingSenderId: "100345757491",
    appId: "1:100345757491:web:c7f3c1d93835f0dcabc846",
    measurementId: "G-05J05FX4TH"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
db.enablePersistence().catch(err => console.warn('Persistence error:', err));

// Application State
const state = {
    userLocation: null,
    userType: 'patient',
    currentUser: null,
    currentPharmacy: null,
    currentPharmacyId: null,
    pharmacies: [],
    map: null,
    markers: [],
    userMarker: null,
    radiusCircle: null,
    searchRadius: 5,
    selectedMedicine: '',
    isSidebarOpen: false,
    isMobile: window.innerWidth <= 992,
    currentLanguage: 'ar',
    inventoryListener: null
};

// Egypt Coordinates
const EGYPT_COORDINATES = {
    cairo: { lat: 30.0444, lng: 31.2357 },
    zagazig: { lat: 30.4167, lng: 31.5667 },
    cairoNasr: { lat: 30.0481, lng: 31.3405 },
    cairoMaadi: { lat: 29.9667, lng: 31.2500 }
};

// Helper Functions
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('modernToast');
    const icon = toast.querySelector('.toast-icon i');
    const title = toast.querySelector('.toast-title');
    const msg = toast.querySelector('.toast-message');
    let bgColor, iconColor, iconClass, titleText;
    
    switch(type) {
        case 'success':
            bgColor = '#dcfce7'; iconColor = '#166534'; iconClass = 'fa-check-circle'; titleText = 'تم بنجاح';
            break;
        case 'error':
            bgColor = '#fee2e2'; iconColor = '#991b1b'; iconClass = 'fa-exclamation-circle'; titleText = 'خطأ';
            break;
        case 'warning':
            bgColor = '#fef9c3'; iconColor = '#854d0e'; iconClass = 'fa-exclamation-triangle'; titleText = 'تنبيه';
            break;
        default:
            bgColor = '#e6f7ff'; iconColor = '#0284c7'; iconClass = 'fa-info-circle'; titleText = 'معلومات';
    }
    
    toast.querySelector('.toast-icon').style.background = bgColor;
    icon.style.color = iconColor;
    icon.className = `fas ${iconClass}`;
    title.textContent = titleText;
    msg.textContent = message;
    toast.classList.add('show');
    
    if (window.toastTimeout) clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(() => toast.classList.remove('show'), 3000);
}

function showLoading(text = 'جاري التحميل...') {
    document.getElementById('loadingText').textContent = text;
    document.getElementById('loadingScreen').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingScreen').style.display = 'none';
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2-lat1)*Math.PI/180;
    const dLon = (lon2-lon1)*Math.PI/180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Map Functions
async function initializeMap() {
    state.map = L.map('map', { zoomControl: false }).setView([EGYPT_COORDINATES.cairo.lat, EGYPT_COORDINATES.cairo.lng], 12);
    L.control.zoom({ position: 'bottomright' }).addTo(state.map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: 'OpenStreetMap', maxZoom: 19 }).addTo(state.map);
}

async function initializeLocation() {
    if (!navigator.geolocation) {
        setDefaultLocation();
        return;
    }
    
    try {
        showLoading('جاري تحديد موقعك...');
        const pos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
        });
        state.userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        state.map.setView([state.userLocation.lat, state.userLocation.lng], 14);
        addUserMarker();
        updateRadiusCircle();
        document.getElementById('locationText').textContent = 'تم تحديد موقعك بنجاح';
        hideLoading();
        showToast('تم تحديد موقعك', 'success');
    } catch (err) {
        setDefaultLocation();
        hideLoading();
        showToast('تعذر تحديد الموقع، تم استخدام موقع القاهرة الافتراضي', 'warning');
    }
}

function setDefaultLocation() {
    state.userLocation = { lat: EGYPT_COORDINATES.cairo.lat, lng: EGYPT_COORDINATES.cairo.lng };
    state.map.setView([state.userLocation.lat, state.userLocation.lng], 12);
    addUserMarker();
    updateRadiusCircle();
    document.getElementById('locationText').textContent = 'القاهرة (موقع افتراضي)';
}

function addUserMarker() {
    if (state.userMarker) state.map.removeLayer(state.userMarker);
    state.userMarker = L.marker([state.userLocation.lat, state.userLocation.lng], {
        icon: L.divIcon({ html: '<div style="background:#4cc9f0; width:20px; height:20px; border-radius:50%; border:3px solid white;"></div>', iconSize: [26,26] })
    }).addTo(state.map).bindPopup('موقعك');
}

function updateRadiusCircle() {
    if (state.radiusCircle) state.map.removeLayer(state.radiusCircle);
    if (state.userLocation) {
        state.radiusCircle = L.circle([state.userLocation.lat, state.userLocation.lng], {
            color: '#4cc9f0',
            fillColor: '#4cc9f0',
            fillOpacity: 0.1,
            radius: state.searchRadius * 1000,
            weight: 2
        }).addTo(state.map);
    }
}

function clearMarkers() {
    state.markers.forEach(m => state.map.removeLayer(m));
    state.markers = [];
}

function addPharmacyMarker(pharmacy) {
    const isCurrent = state.currentPharmacy && state.currentPharmacy.id === pharmacy.id;
    const marker = L.marker([pharmacy.location.lat, pharmacy.location.lng], {
        icon: L.divIcon({
            html: `<div style="background:${isCurrent ? '#7209b7' : '#2a9d8f'}; width:18px; height:18px; border-radius:50%; border:3px solid white;"></div>`,
            iconSize: [24,24]
        })
    }).addTo(state.map)
      .bindPopup(`<b>${escapeHtml(pharmacy.name)}</b><br>${escapeHtml(pharmacy.address)}`)
      .on('click', () => showPharmacyDetails(pharmacy.id));
    state.markers.push(marker);
}

function showAllPharmaciesOnMap() {
    clearMarkers();
    if (state.userLocation) addUserMarker();
    state.pharmacies.forEach(ph => {
        if (ph.location) addPharmacyMarker(ph);
    });
    
    if (state.userLocation && state.pharmacies.length) {
        const bounds = L.latLngBounds([
            [state.userLocation.lat, state.userLocation.lng],
            ...state.pharmacies.map(p => [p.location.lat, p.location.lng])
        ]);
        state.map.fitBounds(bounds, { padding: [30,30], maxZoom: 14 });
    }
}

function updateMapWithResults(results) {
    clearMarkers();
    if (state.userLocation) addUserMarker();
    
    results.forEach(ph => {
        const color = ph.medicine.stock === 'high' ? '#2a9d8f' : 
                     (ph.medicine.stock === 'medium' ? '#f4a261' : 
                     (ph.medicine.stock === 'low' ? '#f97316' : '#e76f51'));
        const marker = L.marker([ph.location.lat, ph.location.lng], {
            icon: L.divIcon({ html: `<div style="background:${color}; width:20px; height:20px; border-radius:50%; border:3px solid white;"></div>`, iconSize: [26,26] })
        }).addTo(state.map)
          .bindPopup(`<b>${escapeHtml(ph.name)}</b><br>${escapeHtml(ph.medicine.name)}`)
          .on('click', () => showPharmacyDetails(ph.id));
        state.markers.push(marker);
    });
    
    if (results.length) {
        const bounds = L.latLngBounds(results.map(p => [p.location.lat, p.location.lng]));
        if (state.userLocation) bounds.extend([state.userLocation.lat, state.userLocation.lng]);
        state.map.fitBounds(bounds, { padding: [40,40], maxZoom: 15 });
    }
}

// Pharmacy Data Functions
async function loadPharmacies() {
    try {
        showLoading('جاري تحميل الصيدليات...');
        const snapshot = await db.collection('pharmacies').limit(50).get();
        state.pharmacies = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (state.pharmacies.length === 0) loadMockData();
        hideLoading();
        showAllPharmaciesOnMap();
        renderRecentPharmacies();
    } catch (err) {
        console.error(err);
        hideLoading();
        loadMockData();
        showToast('فشل تحميل البيانات، عرض بيانات تجريبية', 'warning');
    }
}

function loadMockData() {
    state.pharmacies = [
        {
            id: 'ph1',
            name: 'صيدلية النيل',
            address: 'ميدان التحرير، القاهرة',
            phone: '01001234567',
            location: EGYPT_COORDINATES.cairo,
            registeredAt: new Date().toISOString(),
            inventory: [
                { name: 'أموكسيسيلين', stock: 'high', price: '25.00 ج.م' },
                { name: 'ميتفورمين', stock: 'medium', price: '18.50 ج.م' }
            ]
        },
        {
            id: 'ph2',
            name: 'صيدلية الشرقية',
            address: 'شارع الجامع، الزقازيق، الشرقية',
            phone: '01008765432',
            location: EGYPT_COORDINATES.zagazig,
            registeredAt: new Date().toISOString(),
            inventory: [
                { name: 'أموكسيسيلين', stock: 'low', price: '26.00 ج.م' },
                { name: 'باراسيتامول', stock: 'high', price: '12.00 ج.م' }
            ]
        },
        {
            id: 'ph3',
            name: 'صيدلية مدينة نصر',
            address: 'شارع عباس العقاد، مدينة نصر، القاهرة',
            phone: '01002345678',
            location: EGYPT_COORDINATES.cairoNasr,
            registeredAt: new Date().toISOString(),
            inventory: [
                { name: 'فينتولين', stock: 'high', price: '45.00 ج.م' },
                { name: 'أوميبرازول', stock: 'medium', price: '28.00 ج.م' }
            ]
        },
        {
            id: 'ph4',
            name: 'صيدلة المعادي',
            address: 'شارع 9، المعادي، القاهرة',
            phone: '01009876543',
            location: EGYPT_COORDINATES.cairoMaadi,
            registeredAt: new Date().toISOString(),
            inventory: [
                { name: 'لوسارتان', stock: 'high', price: '32.50 ج.م' },
                { name: 'أسبرين', stock: 'medium', price: '8.00 ج.م' }
            ]
        }
    ];
}

function renderRecentPharmacies() {
    const container = document.getElementById('recentPharmaciesList');
    container.innerHTML = '';
    const sorted = [...state.pharmacies]
        .filter(p => p.registeredAt)
        .sort((a,b) => new Date(b.registeredAt) - new Date(a.registeredAt))
        .slice(0,5);
    
    if (!sorted.length) {
        container.innerHTML = '<p style="text-align:center;padding:20px;">لا توجد صيدليات حديثة</p>';
        return;
    }
    
    sorted.forEach(ph => {
        container.appendChild(createPharmacyCard(ph, null, null));
    });
}

function createPharmacyCard(pharmacy, distance, medicine) {
    const div = document.createElement('div');
    div.className = 'pharmacy-card';
    div.setAttribute('data-id', pharmacy.id);
    const name = escapeHtml(pharmacy.name);
    const addr = escapeHtml(pharmacy.address);
    const dist = distance ? `${distance} كم` : 'غير معروف';
    let medicineHtml = '';
    
    if (medicine) {
        const medName = escapeHtml(medicine.name);
        const stockClass = medicine.stock === 'high' ? 'stock-high' : 
                          (medicine.stock === 'medium' ? 'stock-medium' : 
                          (medicine.stock === 'low' ? 'stock-low' : 'stock-out'));
        const stockText = medicine.stock === 'high' ? 'مخزون عالي' : 
                         (medicine.stock === 'medium' ? 'مخزون متوسط' : 
                         (medicine.stock === 'low' ? 'مخزون منخفض' : 'نفذ من المخزون'));
        medicineHtml = `<div class="medicine-stock"><span style="font-weight:600;">${medName}</span><span class="stock-chip ${stockClass}">${stockText} • ${medicine.price || ''}</span></div>`;
    }
    
    div.innerHTML = `
        <div class="pharmacy-name"><h4>${name}</h4><span class="pharmacy-distance">${dist}</span></div>
        <div class="pharmacy-address"><i class="fas fa-map-marker-alt"></i> ${addr}</div>
        ${medicineHtml}
    `;
    div.addEventListener('click', () => showPharmacyDetails(pharmacy.id));
    return div;
}

function showPharmacyDetails(id) {
    const ph = state.pharmacies.find(p => p.id === id);
    if (!ph) return;
    
    const modal = document.getElementById('pharmacyModal');
    document.getElementById('modalPharmacyName').textContent = ph.name;
    const detailsDiv = document.getElementById('modalDetails');
    let distance = '';
    
    if (state.userLocation && ph.location) {
        distance = calculateDistance(state.userLocation.lat, state.userLocation.lng, ph.location.lat, ph.location.lng).toFixed(1);
    }
    
    let medsHtml = '<h4>الأدوية المتوفرة</h4>';
    if (ph.inventory && ph.inventory.length) {
        medsHtml += '<ul>';
        ph.inventory.forEach(m => {
            medsHtml += `<li>${escapeHtml(m.name)} - ${m.stock === 'high' ? 'متوفر' : (m.stock === 'medium' ? 'متوسط' : (m.stock === 'low' ? 'منخفض' : 'نفذ'))} ${m.price || ''}</li>`;
        });
        medsHtml += '</ul>';
    } else {
        medsHtml += '<p>لا توجد أدوية متوفرة</p>';
    }
    
    detailsDiv.innerHTML = `
        <div><i class="fas fa-map-marker-alt"></i> ${escapeHtml(ph.address)}</div>
        <div><i class="fas fa-phone"></i> ${escapeHtml(ph.phone || 'غير متوفر')}</div>
        <div><i class="fas fa-location-arrow"></i> ${distance ? distance + ' كم' : 'غير معروف'}</div>
        ${medsHtml}
    `;
    
    document.getElementById('getDirectionsBtn').onclick = () => {
        if (ph.location) {
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${ph.location.lat},${ph.location.lng}`, '_blank');
        }
    };
    modal.style.display = 'flex';
}

function closePharmacyModal() {
    document.getElementById('pharmacyModal').style.display = 'none';
}

// Search Functions
function searchMedicine(medicineName) {
    if (!medicineName) return;
    showLoading('جاري البحث...');
    
    setTimeout(() => {
        const term = medicineName.toLowerCase();
        const results = [];
        
        state.pharmacies.forEach(ph => {
            if (!ph.inventory || !ph.location) return;
            const med = ph.inventory.find(m => m.name && m.name.toLowerCase().includes(term));
            if (!med) return;
            
            let distance = Infinity;
            if (state.userLocation) {
                distance = calculateDistance(state.userLocation.lat, state.userLocation.lng, ph.location.lat, ph.location.lng);
            }
            if (distance <= state.searchRadius) {
                results.push({ ...ph, distance, medicine: med });
            }
        });
        
        results.sort((a,b) => a.distance - b.distance);
        displaySearchResults(results, medicineName);
        updateMapWithResults(results);
        hideLoading();
        
        if (!results.length) {
            showToast(`لم يتم العثور على "${medicineName}" ضمن ${state.searchRadius} كم`, 'info');
        } else {
            showToast(`تم العثور على ${results.length} صيدلية`, 'success');
        }
    }, 100);
}

function displaySearchResults(results, medicineName) {
    const container = document.getElementById('pharmacyResults');
    const resultsDiv = document.getElementById('patientResults');
    const countSpan = document.getElementById('resultCount');
    
    if (!results.length) {
        resultsDiv.style.display = 'none';
        return;
    }
    
    container.innerHTML = '';
    results.forEach(ph => {
        const distance = ph.distance ? ph.distance.toFixed(1) : 'غير معروف';
        container.appendChild(createPharmacyCard(ph, distance, ph.medicine));
    });
    
    resultsDiv.style.display = 'block';
    countSpan.textContent = `${results.length} صيدلية`;
}

// Inventory Management Functions
function createInventoryItem(item, index) {
    const div = document.createElement('div');
    div.className = 'pharmacy-card';
    const name = escapeHtml(item.name);
    const price = escapeHtml(item.price || 'غير محدد');
    const stockClass = item.stock === 'high' ? 'stock-high' : 
                      (item.stock === 'medium' ? 'stock-medium' : 
                      (item.stock === 'low' ? 'stock-low' : 'stock-out'));
    const stockText = item.stock === 'high' ? 'مخزون عالي' : 
                     (item.stock === 'medium' ? 'مخزون متوسط' : 
                     (item.stock === 'low' ? 'مخزون منخفض' : 'نفذ من المخزون'));
    
    div.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div><h4 style="margin:0 0 4px;">${name}</h4><span style="color: var(--text-muted);">${price}</span></div>
            <div style="display: flex; gap:8px;">
                <select data-index="${index}" class="stock-select" style="padding:8px; border-radius:var(--radius-md); border:1px solid var(--border-color);">
                    <option value="high" ${item.stock === 'high' ? 'selected' : ''}>عالي</option>
                    <option value="medium" ${item.stock === 'medium' ? 'selected' : ''}>متوسط</option>
                    <option value="low" ${item.stock === 'low' ? 'selected' : ''}>منخفض</option>
                    <option value="out" ${item.stock === 'out' ? 'selected' : ''}>نفذ</option>
                </select>
                <button class="remove-btn" data-index="${index}" style="background:none; border:none; color:var(--danger-color); cursor:pointer;"><i class="fas fa-trash"></i></button>
            </div>
        </div>
        <div style="margin-top:8px;"><span class="stock-chip ${stockClass}">${stockText}</span></div>
    `;
    
    div.querySelector('.stock-select').addEventListener('change', (e) => updateStock(index, e.target.value));
    div.querySelector('.remove-btn').addEventListener('click', () => removeMedicineItem(index));
    return div;
}

function renderInventory(inventory) {
    const container = document.getElementById('inventoryList');
    container.innerHTML = '';
    
    if (!inventory.length) {
        container.innerHTML = '<div style="text-align:center; padding:40px;"><i class="fas fa-box-open"></i><p>لا توجد أدوية</p></div>';
        return;
    }
    
    inventory.forEach((item, idx) => {
        container.appendChild(createInventoryItem(item, idx));
    });
}

async function loadInventory() {
    if (!state.currentPharmacyId) return;
    try {
        const doc = await db.collection('pharmacies').doc(state.currentPharmacyId).get();
        if (doc.exists) {
            const inv = doc.data().inventory || [];
            if (state.currentPharmacy) state.currentPharmacy.inventory = inv;
            renderInventory(inv);
        }
    } catch (err) {
        showToast('فشل تحميل المخزون', 'error');
    }
}

async function addMedicine() {
    const name = document.getElementById('addMedicineInput').value.trim();
    if (!name) {
        showToast('أدخل اسم الدواء', 'error');
        return;
    }
    
    try {
        showLoading('جاري الإضافة...');
        const ref = db.collection('pharmacies').doc(state.currentPharmacyId);
        const doc = await ref.get();
        const inv = doc.data().inventory || [];
        
        if (inv.some(i => i.name.toLowerCase() === name.toLowerCase())) {
            hideLoading();
            showToast('الدواء موجود بالفعل', 'warning');
            return;
        }
        
        inv.push({ 
            name, 
            stock: 'high', 
            price: (Math.random() * 40 + 10).toFixed(2) + ' ج.م', 
            addedAt: new Date().toISOString() 
        });
        
        await ref.update({ inventory: inv, updatedAt: new Date().toISOString() });
        document.getElementById('addMedicineInput').value = '';
        hideLoading();
        showToast(`تم إضافة ${name}`, 'success');
    } catch (err) {
        hideLoading();
        showToast('فشل الإضافة', 'error');
    }
}

async function updateStock(index, status) {
    if (!state.currentPharmacyId) return;
    try {
        const ref = db.collection('pharmacies').doc(state.currentPharmacyId);
        const doc = await ref.get();
        const inv = doc.data().inventory || [];
        if (inv[index]) {
            inv[index].stock = status;
            await ref.update({ inventory: inv });
            showToast('تم التحديث', 'success');
        }
    } catch (err) {
        showToast('فشل التحديث', 'error');
    }
}

async function removeMedicineItem(index) {
    if (!state.currentPharmacyId) return;
    const name = state.currentPharmacy?.inventory[index]?.name;
    if (!confirm(`هل أنت متأكد من حذف "${name}"؟`)) return;
    
    try {
        const ref = db.collection('pharmacies').doc(state.currentPharmacyId);
        const doc = await ref.get();
        const inv = doc.data().inventory || [];
        inv.splice(index, 1);
        await ref.update({ inventory: inv });
        showToast('تم الحذف', 'success');
    } catch (err) {
        showToast('فشل الحذف', 'error');
    }
}

async function removeOutOfStock() {
    if (!state.currentPharmacyId) return;
    try {
        const ref = db.collection('pharmacies').doc(state.currentPharmacyId);
        const doc = await ref.get();
        const inv = doc.data().inventory || [];
        const newInv = inv.filter(i => i.stock !== 'out');
        
        if (inv.length === newInv.length) {
            showToast('لا توجد أدوية منتهية', 'info');
            return;
        }
        
        await ref.update({ inventory: newInv });
        showToast(`تم حذف ${inv.length - newInv.length} دواء`, 'success');
    } catch (err) {
        showToast('فشل الحذف', 'error');
    }
}

// Authentication Functions
async function handleLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const pwd = document.getElementById('loginPassword').value;
    
    if (!email || !pwd) {
        showToast('املأ جميع الحقول', 'error');
        return;
    }
    
    try {
        showLoading('جاري تسجيل الدخول...');
        await auth.signInWithEmailAndPassword(email, pwd);
        hideLoading();
        showToast('تم تسجيل الدخول', 'success');
    } catch (err) {
        hideLoading();
        showToast('فشل تسجيل الدخول: ' + err.message, 'error');
    }
}

async function handleRegister() {
    const name = document.getElementById('pharmacyName').value.trim();
    const email = document.getElementById('pharmacyEmail').value.trim();
    const pwd = document.getElementById('pharmacyPassword').value;
    const phone = document.getElementById('pharmacyPhone').value.trim();
    const address = document.getElementById('pharmacyAddress').value.trim();
    
    if (!name || !email || !pwd || !phone || !address) {
        showToast('املأ جميع الحقول', 'error');
        return;
    }
    
    if (pwd.length < 6) {
        showToast('كلمة المرور 6 أحرف على الأقل', 'error');
        return;
    }
    
    try {
        showLoading('جاري التسجيل...');
        const cred = await auth.createUserWithEmailAndPassword(email, pwd);
        await cred.user.updateProfile({ displayName: name });
        
        const phData = {
            name,
            email,
            phone,
            address,
            location: state.userLocation || EGYPT_COORDINATES.cairo,
            inventory: [],
            ownerId: cred.user.uid,
            registeredAt: new Date().toISOString()
        };
        
        const docRef = await db.collection('pharmacies').add(phData);
        state.currentPharmacy = { id: docRef.id, ...phData };
        state.currentPharmacyId = docRef.id;
        state.pharmacies.push(state.currentPharmacy);
        
        hideLoading();
        showToast(`مرحباً ${name}`, 'success');
        switchUserType('pharmacy');
    } catch (err) {
        hideLoading();
        showToast('فشل التسجيل: ' + err.message, 'error');
    }
}

async function handleLogout() {
    try {
        showLoading('جاري تسجيل الخروج...');
        await auth.signOut();
        hideLoading();
        showToast('تم تسجيل الخروج', 'success');
        if (state.userType === 'pharmacy') {
            switchUserType('patient');
        }
    } catch (err) {
        hideLoading();
        showToast('فشل تسجيل الخروج', 'error');
    }
}

// UI Switching Functions
function switchUserType(type) {
    state.userType = type;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.tab-btn[data-type="${type}"]`).classList.add('active');
    document.querySelectorAll('.panel').forEach(p => p.style.display = 'none');
    
    if (type === 'patient') {
        document.getElementById('patientPanel').style.display = 'block';
        showAllPharmaciesOnMap();
    } else {
        document.getElementById('pharmacyPanel').style.display = 'block';
        
        // Handle pharmacy panel based on auth state
        if (state.currentUser && state.currentPharmacy) {
            // Logged in with pharmacy
            document.getElementById('inventorySection').style.display = 'block';
            document.getElementById('loginForm').style.display = 'none';
            document.getElementById('registerForm').style.display = 'none';
            document.getElementById('loggedPharmacyName').textContent = state.currentPharmacy.name;
            document.getElementById('loggedPharmacyAddress').textContent = state.currentPharmacy.address;
            loadInventory();
            
            // Setup real-time listener
            if (state.inventoryListener) state.inventoryListener();
            state.inventoryListener = db.collection('pharmacies').doc(state.currentPharmacyId).onSnapshot(doc => {
                if (doc.exists) {
                    if (state.currentPharmacy) state.currentPharmacy.inventory = doc.data().inventory || [];
                    renderInventory(state.currentPharmacy?.inventory || []);
                }
            });
        } else if (state.currentUser && !state.currentPharmacy) {
            // Logged in but no pharmacy - show register form
            document.getElementById('inventorySection').style.display = 'none';
            document.getElementById('loginForm').style.display = 'none';
            document.getElementById('registerForm').style.display = 'block';
            // Pre-fill email if available
            if (state.currentUser.email) {
                document.getElementById('pharmacyEmail').value = state.currentUser.email;
            }
        } else {
            // Not logged in - show login form
            document.getElementById('inventorySection').style.display = 'none';
            document.getElementById('loginForm').style.display = 'block';
            document.getElementById('registerForm').style.display = 'none';
        }
    }
    
    if (state.isMobile && !state.isSidebarOpen) openSidebar();
}

// UI Helpers
function showSuggestions(query) {
    const container = document.getElementById('searchSuggestions');
    if (!query.trim()) {
        container.style.display = 'none';
        return;
    }
    
    const common = ['أموكسيسيلين', 'ميتفورمين', 'فينتولين', 'أيبوبروفين', 'باراسيتامول'];
    const filtered = common.filter(m => m.includes(query)).slice(0,5);
    
    if (!filtered.length) {
        container.style.display = 'none';
        return;
    }
    
    container.innerHTML = filtered.map(m => 
        `<div class="search-suggestion-item"><i class="fas fa-pills"></i><span>${escapeHtml(m)}</span></div>`
    ).join('');
    container.style.display = 'block';
    
    container.querySelectorAll('.search-suggestion-item').forEach(el => {
        el.addEventListener('click', () => {
            const med = el.querySelector('span').textContent;
            document.getElementById('medicineSearch').value = med;
            container.style.display = 'none';
            searchMedicine(med);
        });
    });
}

function toggleSidebar() {
    state.isSidebarOpen ? closeSidebar() : openSidebar();
}

function openSidebar() {
    document.getElementById('pharmaSidebar').classList.add('open');
    state.isSidebarOpen = true;
    document.getElementById('sidebarBackdrop').style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeSidebar() {
    document.getElementById('pharmaSidebar').classList.remove('open');
    state.isSidebarOpen = false;
    document.getElementById('sidebarBackdrop').style.display = 'none';
    document.body.style.overflow = '';
}

function checkMobileView() {
    const isMobile = window.innerWidth <= 992;
    if (!isMobile) {
        closeSidebar();
        document.getElementById('mobileMenuBtn').style.display = 'none';
    } else {
        document.getElementById('mobileMenuBtn').style.display = 'flex';
    }
}

function debounce(fn, delay) {
    let timer;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

// Initialize UI Event Listeners
function initializeUI() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchUserType(btn.dataset.type));
    });
    
    // Mobile menu
    document.getElementById('mobileMenuBtn').addEventListener('click', toggleSidebar);
    document.getElementById('sidebarBackdrop').addEventListener('click', closeSidebar);
    document.getElementById('mobileFab').addEventListener('click', () => {
        if (state.userType === 'patient') {
            searchMedicine(document.getElementById('medicineSearch').value);
        } else {
            switchUserType('pharmacy');
        }
    });
    
    // Search radius slider
    const slider = document.getElementById('searchRadius');
    slider.addEventListener('input', () => {
        state.searchRadius = parseInt(slider.value);
        document.getElementById('radiusValue').textContent = state.searchRadius;
        updateRadiusCircle();
    });
    
    // Search button
    document.getElementById('searchBtn').addEventListener('click', () => {
        searchMedicine(document.getElementById('medicineSearch').value);
    });
    
    // Sample medicine clicks
    document.querySelectorAll('.sample-med').forEach(el => {
        el.addEventListener('click', () => {
            document.getElementById('medicineSearch').value = el.textContent;
            searchMedicine(el.textContent);
        });
    });
    
    // Auth form toggles
    document.getElementById('showRegister').addEventListener('click', () => {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('registerForm').style.display = 'block';
    });
    
    document.getElementById('showLogin').addEventListener('click', () => {
        document.getElementById('registerForm').style.display = 'none';
        document.getElementById('loginForm').style.display = 'block';
    });
    
    // Auth buttons
    document.getElementById('loginBtn').addEventListener('click', handleLogin);
    document.getElementById('registerBtn').addEventListener('click', handleRegister);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    // Inventory buttons
    document.getElementById('addMedicineBtn').addEventListener('click', addMedicine);
    document.getElementById('removeOutOfStockBtn').addEventListener('click', removeOutOfStock);
    
    // Modals
    document.getElementById('aboutBtn').addEventListener('click', () => {
        document.getElementById('aboutModal').style.display = 'flex';
    });
    document.getElementById('closeAboutModal').addEventListener('click', () => {
        document.getElementById('aboutModal').style.display = 'none';
    });
    document.getElementById('closePharmacyModal').addEventListener('click', closePharmacyModal);
    
    // Map legend toggle
    document.getElementById('mapLegend').addEventListener('click', function() {
        this.classList.toggle('collapsed');
    });
    
    // Language toggle
    document.getElementById('langToggleBtn').addEventListener('click', () => {
        document.documentElement.lang = document.documentElement.lang === 'ar' ? 'en' : 'ar';
        document.documentElement.dir = document.documentElement.dir === 'rtl' ? 'ltr' : 'rtl';
        showToast('تم تبديل اللغة', 'info');
    });
    
    // Window resize
    window.addEventListener('resize', () => {
        state.isMobile = window.innerWidth <= 992;
        checkMobileView();
        if (state.map) state.map.invalidateSize();
    });
    
    checkMobileView();
    
    // Search suggestions
    const searchInput = document.getElementById('medicineSearch');
    searchInput.addEventListener('input', debounce(() => showSuggestions(searchInput.value), 300));
    
    // Password toggle buttons
    document.getElementById('toggleLoginPassword').addEventListener('click', () => {
        const pwdInput = document.getElementById('loginPassword');
        const type = pwdInput.type === 'password' ? 'text' : 'password';
        pwdInput.type = type;
    });
    
    document.getElementById('toggleRegisterPassword').addEventListener('click', () => {
        const pwdInput = document.getElementById('pharmacyPassword');
        const type = pwdInput.type === 'password' ? 'text' : 'password';
        pwdInput.type = type;
    });
}

// App Initialization
document.addEventListener('DOMContentLoaded', async () => {
    initializeUI();
    await initializeMap();
    await initializeLocation();
    await loadPharmacies();
    
    auth.onAuthStateChanged(async user => {
        if (user) {
            state.currentUser = user;
            document.getElementById('userChip').style.display = 'flex';
            document.getElementById('userName').textContent = user.displayName || user.email.split('@')[0];
            document.getElementById('userAvatar').textContent = (user.displayName || user.email).charAt(0).toUpperCase();
            document.getElementById('logoutBtn').style.display = 'flex';
            
            const snap = await db.collection('pharmacies').where('ownerId', '==', user.uid).limit(1).get();
            if (!snap.empty) {
                const doc = snap.docs[0];
                state.currentPharmacy = { id: doc.id, ...doc.data() };
                state.currentPharmacyId = doc.id;
                if (state.userType === 'pharmacy') {
                    switchUserType('pharmacy');
                }
            } else {
                state.currentPharmacy = null;
                state.currentPharmacyId = null;
                if (state.userType === 'pharmacy') {
                    switchUserType('pharmacy');
                }
            }
        } else {
            state.currentUser = null;
            state.currentPharmacy = null;
            state.currentPharmacyId = null;
            document.getElementById('userChip').style.display = 'none';
            document.getElementById('logoutBtn').style.display = 'none';
            if (state.inventoryListener) {
                state.inventoryListener();
                state.inventoryListener = null;
            }
            if (state.userType === 'pharmacy') {
                switchUserType('patient');
            }
        }
    });
});