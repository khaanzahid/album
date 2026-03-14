let upload = document.getElementById("upload");
let modal = document.getElementById("modal");
let modalImg = document.getElementById("modalImg");
let favBtn = document.getElementById("favBtn");

let editTitle = document.getElementById("editTitle");
let polaroidColor = document.getElementById("polaroidColor");
let fontColor = document.getElementById("fontColor");
let storyInput = document.getElementById("storyInput");
let saveStory = document.getElementById("saveStory");
let searchInput = document.getElementById("searchInput");
let photoStats = document.getElementById("photoStats");

let currentPolaroid = null;
let currentSrc = null;
let currentCaption = null;
let currentId = null;

let scrollTopBtn = document.getElementById("scrollTopBtn");
let isTrashOpen = false;
let allPhotos = [];
let currentFilter = 'all'; // 'all', 'favorites', or album name
let isPrintMode = false;
let selectedForPrint = [];
let currentBatch = 1;
let currentBatchSub = 1;

let currentUser = null;
let currentUserAlbumNames = []; // album names for current user only (for duplicate check)
let notifications = JSON.parse(localStorage.getItem('notifications') || '[]');

// --- Notifications ---

function addNotification(message) {
    const notif = {
        id: Date.now(),
        message,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        read: false
    };
    notifications.unshift(notif);
    if (notifications.length > 20) notifications.pop();
    localStorage.setItem('notifications', JSON.stringify(notifications));
    renderNotifications();
}

function renderNotifications() {
    const list = document.getElementById('notificationList');
    const badge = document.getElementById('notificationBadge');
    if (!list) return;

    const unreadCount = notifications.filter(n => !n.read).length;
    if (unreadCount > 0) {
        badge.innerText = unreadCount;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }

    if (notifications.length === 0) {
        list.innerHTML = '<p class="empty-notif">No new notifications</p>';
        return;
    }

    list.innerHTML = notifications.map(n => `
        <div class="notification-item ${n.read ? 'read' : ''}">
            <p>${n.message}</p>
            <span class="notif-time">${n.time}</span>
        </div>
    `).join('');
}

function clearNotifications() {
    notifications = [];
    localStorage.setItem('notifications', JSON.stringify(notifications));
    renderNotifications();
}

function toggleNotifications(e) {
    e.stopPropagation();
    const dropdown = document.getElementById('notificationDropdown');
    dropdown.classList.toggle('hidden');
    if (!dropdown.classList.contains('hidden')) {
        notifications.forEach(n => n.read = true);
        localStorage.setItem('notifications', JSON.stringify(notifications));
        renderNotifications();
    }
}

// --- Authentication (Clerk) ---

async function initClerk() {
    try {
        await Clerk.load();

        if (Clerk.user) {
            currentUser = Clerk.user;
            document.getElementById('app-auth-container').classList.add('hidden');
            await loadAlbums();
            await loadPhotos();
        } else {
            document.getElementById('app-auth-container').classList.remove('hidden');
            Clerk.mountSignIn(document.getElementById('clerk-sign-in'));
        }

        Clerk.addListener(({ user }) => {
            if (user) {
                currentUser = user;
                document.getElementById('app-auth-container').classList.add('hidden');
                loadAlbums();
                loadPhotos();
            } else {
                currentUser = null;
                currentUserAlbumNames = [];
                document.getElementById('app-auth-container').classList.remove('hidden');
                Clerk.mountSignIn(document.getElementById('clerk-sign-in'));
                allPhotos = [];
                renderWall();
            }
        });
    } catch (err) {
        console.error('Clerk load error:', err);
    }
}

async function getAuthHeaders() {
    const token = await Clerk.session.getToken();
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}

async function logout(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!confirm("Are you sure you want to logout?")) return;
    try {
        addNotification("Logging out...");
        if (typeof Clerk !== 'undefined' && Clerk.isLoaded()) {
            await Clerk.signOut();
            // Clerk.addListener will handle showing the sign-in modal
        } else {
            console.error("Clerk not fully loaded, trying fallback logout...");
            window.location.href = '/';
        }
    } catch (err) {
        console.error("Logout failed", err);
    }
}

// --- Initialization ---

window.onload = async () => {
    createStars();
    createFloatingObjects();
    renderNotifications();
    
    // Auth listeners
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.onclick = logout;

    // Notifications toggle
    const notifBtn = document.getElementById('notificationBtn');
    if (notifBtn) notifBtn.onclick = toggleNotifications;

    // Profile click
    const profileBtn = document.getElementById('profileBtn');
    if (profileBtn) {
        profileBtn.onclick = () => {
            if (Clerk.user) {
                Clerk.openUserProfile();
            } else {
                addNotification("Please sign in to view your profile");
            }
        };
    }

    // Close dropdown on outside click
    document.addEventListener('click', () => {
        const dropdown = document.getElementById('notificationDropdown');
        if (dropdown) dropdown.classList.add('hidden');
    });

    // Initialize Clerk
    await initClerk();
    
    // Check for saved theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    // Click background to return to main page
    const wallContainer = document.querySelector('.wall-container');
    if (wallContainer) {
        wallContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('wall') || e.target.classList.contains('wall-container') || e.target.tagName === 'H1') {
                filterBy('all');
            }
        });
    }

    // Modal backdrop click to close
    modal.onclick = (e) => {
        if (e.target === modal) closeModal();
    };

    // Modal Enter key to save
    modal.addEventListener('keydown', (e) => {
        if (e.key === "Enter" && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) {
            if (e.target.tagName === "TEXTAREA" && !e.ctrlKey) return; // Allow new lines in textarea unless Ctrl+Enter
            e.preventDefault();
            saveStory.click();
        }
    });
    
    const albumModal = document.getElementById('albumModal');
    if (albumModal) {
        albumModal.onclick = (e) => {
            if (e.target === albumModal) closeAlbumModal();
        };
    }
    const confirmAlbumBtn = document.getElementById('confirmAlbumBtn');
    if (confirmAlbumBtn) confirmAlbumBtn.onclick = confirmCreateAlbum;
    
    const nav = document.querySelector('.sidebar-nav');
    if (nav) {
        nav.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                const s = document.querySelector('.sidebar');
                if (s) s.classList.remove('open');
                const ov = document.querySelector('.sidebar-overlay');
                if (ov) ov.classList.remove('visible');
            }
        });
    }
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeSidebar();
    });
    
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            const s = document.querySelector('.sidebar');
            const ov = document.querySelector('.sidebar-overlay');
            if (s) s.classList.remove('open');
            if (ov) ov.classList.remove('visible');
        }
    });
};

// --- Theme Management ---

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const target = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', target);
    localStorage.setItem('theme', target);
    updateThemeIcon(target);
    createStars();
    createFloatingObjects();
}

function updateThemeIcon(theme) {
    const icon = document.getElementById('themeIcon');
    const search = document.getElementById('searchInput');
    if (!icon) return;
    if (theme === 'dark') {
        icon.className = 'icon-sun';
        if (search) search.placeholder = "Explore your cosmic memories...";
    } else {
        icon.className = 'icon-moon';
        if (search) search.placeholder = "Search your memories...";
    }
}

function createStars() {
    const container = document.querySelector('.stars-container');
    if (!container) return;
    container.innerHTML = '';
    const count = 150;
    for (let i = 0; i < count; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        const x = Math.random() * 100;
        const y = Math.random() * 100;
        const size = Math.random() * 3;
        const duration = 2 + Math.random() * 4;
        
        star.style.left = `${x}%`;
        star.style.top = `${y}%`;
        star.style.width = `${size}px`;
        star.style.height = `${size}px`;
        star.style.setProperty('--duration', `${duration}s`);
        
        container.appendChild(star);
    }
}

function createFloatingObjects() {
    const container = document.querySelector('.floating-objects');
    if (!container) return;
    container.innerHTML = '';
    
    const types = ['ufo', 'spaceship'];
    const count = 20; // Increased count further
    
    for (let i = 0; i < count; i++) {
        const obj = document.createElement('div');
        const type = types[Math.floor(Math.random() * types.length)];
        obj.className = type;
        
        const x = Math.random() * 95; 
        const y = Math.random() * 95;
        const delay = Math.random() * 30;
        const duration = 20 + Math.random() * 40;
        const scale = 0.3 + Math.random() * 0.8;
        const rotation = Math.random() * 360;
        
        obj.style.left = `${x}%`;
        obj.style.top = `${y}%`;
        obj.style.animationDelay = `-${delay}s`;
        obj.style.animationDuration = `${duration}s`;
        obj.style.setProperty('--scale', scale);
        obj.style.setProperty('--initial-rotation', `${rotation}deg`);
        
        container.appendChild(obj);
    }
}

function toggleSidebar() {
    const s = document.querySelector('.sidebar');
    if (!s) return;
    s.classList.toggle('open');
    const ov = document.querySelector('.sidebar-overlay');
    if (ov) ov.classList.toggle('visible', s.classList.contains('open'));
}

function closeSidebar() {
    const s = document.querySelector('.sidebar');
    const ov = document.querySelector('.sidebar-overlay');
    if (s) s.classList.remove('open');
    if (ov) ov.classList.remove('visible');
}

// --- Albums Management ---

async function loadAlbums() {
    try {
        const response = await fetch('/api/albums', {
            headers: await getAuthHeaders()
        });
        if (response.status === 401) {
            const authEl = document.getElementById('app-auth-container');
            if (authEl) authEl.classList.remove('hidden');
            currentUserAlbumNames = [];
            return;
        }
        const albums = await response.json();
        currentUserAlbumNames = (albums || []).map(a => (a.name || '').toLowerCase());
        const list = document.getElementById("albumsList");
        list.innerHTML = "";
        
        if (albums.length === 0) {
            list.innerHTML = `<div style="padding: 10px; opacity: 0.5; font-size: 12px;">No albums yet</div>`;
            return;
        }
        
        albums.forEach(album => {
            const btn = document.createElement("button");
            btn.id = `btn-album-${album.name}`;
            btn.innerHTML = `<i class="icon-users"></i> <span>${album.name}</span>`;
            btn.onclick = () => filterBy(album.name);
            list.appendChild(btn);
        });
        
        // Ensure active filter is highlighted if it's an album
        if (currentFilter !== 'all' && currentFilter !== 'favorites') {
            const activeBtn = document.getElementById(`btn-album-${currentFilter}`);
            if (activeBtn) activeBtn.classList.add('active');
        }
    } catch (error) {
        console.error('Error loading albums:', error);
        currentUserAlbumNames = [];
    }
}

function openAlbumModal() {
    const albumModal = document.getElementById("albumModal");
    if (!albumModal) return;
    albumModal.style.display = "flex";
    albumModal.classList.remove("hidden");
    setTimeout(() => albumModal.classList.add("active"), 10);
}

async function addNewAlbum() {
    const input = document.getElementById("newAlbumName");
    if (!input) return;
    openAlbumModal();
    input.value = "";
    input.focus();

    // Handle Enter key for this session
    const keyHandler = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            document.getElementById("confirmAlbumBtn").click();
        }
    };
    input.onkeydown = keyHandler;
}

async function confirmCreateAlbum() {
    const input = document.getElementById("newAlbumName");
    if (!input) return;
    const name = input.value.trim();
    if (!name) {
        alert("Please enter an album name.");
        input.focus();
        return;
    }

    if (currentUserAlbumNames.includes(name.toLowerCase())) {
        alert("An album with this name already exists!");
        return;
    }

    try {
        const response = await fetch('/api/albums', {
            method: 'POST',
            headers: await getAuthHeaders(),
            body: JSON.stringify({ name })
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok) {
            await loadAlbums();
            closeAlbumModal();
        } else if (response.status === 401 || response.status === 403) {
            closeAlbumModal();
            const authEl = document.getElementById('app-auth-container');
            if (authEl) authEl.classList.remove('hidden');
        } else {
            const msg = data.error ? `Failed to create album: ${data.error}` : "Failed to create album.";
            alert(msg);
        }
    } catch (error) {
        console.error(error);
        const authEl = document.getElementById('app-auth-container');
        if (authEl && !authEl.classList.contains('hidden')) {
            alert("Could not create album. Check that the server is running.");
        } else {
            alert("Could not create album. Check that you're signed in and the server is running.");
        }
    }
}

function closeAlbumModal() {
    const albumModal = document.getElementById("albumModal");
    albumModal.classList.remove("active");
    setTimeout(() => {
        if (!albumModal.classList.contains("active")) {
            albumModal.style.display = "none";
        }
    }, 300);
}

// --- Photos Management ---

async function loadPhotos() {
    try {
        const response = await fetch('/api/photos', {
            headers: await getAuthHeaders()
        });
        if (response.status === 401) {
            const authEl = document.getElementById('app-auth-container');
            if (authEl) authEl.classList.remove('hidden');
            return;
        }
        allPhotos = await response.json();
        renderWall();
    } catch (error) {
        console.error('Error loading photos:', error);
    }
}

function refreshSelectionNumbers() {
    const allPolaroids = document.querySelectorAll('.polaroid');
    allPolaroids.forEach(box => {
        const id = box.getAttribute('data-id');
        const idx = selectedForPrint.indexOf(id);
        const existingNum = box.querySelector('.selection-number');
        
        if (idx > -1) {
            if (!existingNum) {
                let num = document.createElement("div");
                num.className = "selection-number";
                num.innerText = idx + 1;
                box.appendChild(num);
            } else {
                existingNum.innerText = idx + 1;
            }
        } else if (existingNum) {
            existingNum.remove();
        }
    });
}

function renderWall() {
    const wall = document.getElementById("mainWall");
    const wallTitle = document.getElementById("wallTitle");
    wall.innerHTML = "";
    
    const searchTerm = searchInput.value.toLowerCase();
    
    let filtered = allPhotos.filter(p => {
        const title = (p.title || "").toLowerCase();
        const story = (p.story || "").toLowerCase();
        const matchesSearch = title.includes(searchTerm) || story.includes(searchTerm);
        
        let matchesFilter = true;
        if (currentFilter === 'favorites') matchesFilter = (p.favorite == 1 || p.favorite === true);
        else if (currentFilter !== 'all') matchesFilter = (p.category === currentFilter);
        
        return matchesSearch && matchesFilter;
    });

    const sortVal = document.getElementById("sortWall") ? document.getElementById("sortWall").value : "newest";
    filtered.sort((a, b) => {
        if (sortVal === "newest") return b.id - a.id;
        if (sortVal === "oldest") return a.id - b.id;
        if (sortVal === "titleAZ") return (a.title || "").localeCompare(b.title || "");
        if (sortVal === "titleZA") return (b.title || "").localeCompare(a.title || "");
        if (sortVal === "favFirst") {
            const fa = a.favorite === 1 ? 1 : 0;
            const fb = b.favorite === 1 ? 1 : 0;
            if (fb !== fa) return fb - fa;
            return b.id - a.id;
        }
        return 0;
    });

    // Update Title
    if (isTrashOpen) wallTitle.innerText = "Trash Bin";
    else if (currentFilter === 'all') wallTitle.innerText = "All Photos";
    else if (currentFilter === 'favorites') wallTitle.innerText = "Favorites ❤️";
    else wallTitle.innerText = `${currentFilter} Album`;

    if (filtered.length === 0) {
        wall.innerHTML = `<div class="empty-state">
            ${searchTerm ? 'No matches found.' : 'No photos found here.'}
        </div>`;
    } else {
        filtered.forEach(p => {
            createPolaroid(p.src, p.category, p.favorite === 1, p.title, p.color, p.fontColor, p.id, isTrashOpen);
        });
    }

    if (photoStats) {
        photoStats.innerText = isTrashOpen ? `Trash: ${filtered.length}` : `Total Photos: ${filtered.length}`;
    }
}

function filterBy(type) {
    isTrashOpen = false;
    isPrintMode = false;
    currentFilter = type;
    selectedForPrint = [];
    
    document.getElementById("printControls").style.display = "none";
    document.getElementById("searchInput").parentElement.style.display = "flex";

    // Update active UI
    document.querySelectorAll('.sidebar-nav button').forEach(b => b.classList.remove('active'));
    if (type === 'all') document.getElementById('btn-all').classList.add('active');
    else if (type === 'favorites') document.getElementById('btn-favs').classList.add('active');
    else {
        const albumBtn = document.getElementById(`btn-album-${type}`);
        if (albumBtn) albumBtn.classList.add('active');
    }
    
    loadPhotos();
}

function togglePrintMode() {
    isPrintMode = !isPrintMode;
    isTrashOpen = false;
    selectedForPrint = [];
    currentBatchSub = 1;
    
    document.querySelectorAll('.sidebar-nav button').forEach(b => b.classList.remove('active'));
    
    const printBtn = document.getElementById("btnPrintMode");
    const searchBox = document.getElementById("searchInput").parentElement;
    const printControls = document.getElementById("printControls");
    const wallTitle = document.getElementById("wallTitle");
    const wall = document.getElementById("mainWall");

    if (isPrintMode) {
        printBtn.classList.add('active');
        searchBox.style.display = "none";
        printControls.style.display = "flex";
        wallTitle.innerText = "Select Photos to Print";
        wall.classList.add('print-mode-active');
        updateSelectionLimit();
        loadPhotos();
    } else {
        wall.classList.remove('print-mode-active');
        filterBy('all');
    }
}

function updateSelectionLimit() {
    const limit = parseInt(document.getElementById("printTemplate").value);
    
    // Clear selection if template changes to prevent exceeding new limit
    if (selectedForPrint.length > limit) {
        selectedForPrint = [];
        document.querySelectorAll('.polaroid.selected-for-print').forEach(el => el.classList.remove('selected-for-print'));
        document.querySelectorAll('.selection-number').forEach(el => el.remove());
    }
    
    document.getElementById("selectionCount").innerText = `(${selectedForPrint.length} / ${limit}) Selected`;
    document.getElementById("printBatchLabel").innerText = `Batch ${currentBatch}.${currentBatchSub}`;
}

async function executePrint() {
    const limit = parseInt(document.getElementById("printTemplate").value);
    if (selectedForPrint.length === 0) {
        alert("Please select at least one photo to print.");
        return;
    }

    const template = document.getElementById("printTemplate").value;
    const cols = Math.sqrt(template) || 1; // 1->1, 4->2, 9->3
    const finalCols = (template == 2) ? 2 : Math.ceil(cols);

    // Set CSS variable for print layout
    document.documentElement.style.setProperty('--print-cols', finalCols);

    // Filter allPhotos to only selected ones and render temporary wall
    const wall = document.getElementById("mainWall");
    const originalContent = wall.innerHTML;
    
    const photosToPrint = allPhotos.filter(p => selectedForPrint.includes(p.id));
    wall.innerHTML = "";
    photosToPrint.forEach(p => {
        // Find the full photo object from our global state to get its specific colors
        const photo = allPhotos.find(item => item.id === p.id);
        createPolaroid(photo.src, photo.category, false, photo.title, photo.color, photo.fontColor, photo.id, false);
    });

    window.print();

    // Restore after print
    wall.innerHTML = originalContent;
    
    // Clear selection for next batch
    selectedForPrint = [];
    currentBatchSub++; // Increment sub-batch
    updateSelectionLimit();
    renderWall();
}

async function toggleTrashBin() {
    isTrashOpen = !isTrashOpen;
    isPrintMode = false;
    currentFilter = 'all';
    selectedForPrint = [];
    
    document.getElementById("printControls").style.display = "none";
    document.getElementById("searchInput").parentElement.style.display = "flex";

    document.querySelectorAll('.sidebar-nav button').forEach(b => b.classList.remove('active'));
    if (isTrashOpen) document.getElementById('trashBtn').classList.add('active');
    else document.getElementById('btn-all').classList.add('active');

    if (isTrashOpen) {
        try {
            const response = await fetch('/api/trash', {
                headers: await getAuthHeaders()
            });
            allPhotos = await response.json();
            renderWall();
        } catch (error) { 
            console.error(error); 
        }
    } else {
        loadPhotos();
    }
}

// --- Upload ---

upload.addEventListener("change", async function(){
    let files = Array.from(this.files);
    if(files.length === 0) return;

    // Use current album as category, default to 'Friends'
    let category = (currentFilter === 'all' || currentFilter === 'favorites') ? 'Friends' : currentFilter;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
            const photoData = await compressImage(file, 1280, 0.8);

            await fetch('/api/photos', {
                method: 'POST',
                headers: await getAuthHeaders(),
                body: JSON.stringify({
                    src: photoData,
                    category: category,
                    favorite: false,
                    title: "",
                    story: "",
                    color: "#ffffff",
                    fontColor: "#334155"
                })
            });
            addNotification(`Successfully uploaded ${file.name}`);
        } catch (error) { 
            console.error(error); 
            addNotification(`Failed to upload ${file.name}`);
        }
    }
    this.value = ""; 
    loadPhotos();
});

const uploadArea = document.querySelector(".upload-area");
if (uploadArea) {
    ["dragenter","dragover"].forEach(evt => {
        uploadArea.addEventListener(evt, (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadArea.classList.add("dragover");
        });
    });
    ["dragleave","drop"].forEach(evt => {
        uploadArea.addEventListener(evt, (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadArea.classList.remove("dragover");
        });
    });
    uploadArea.addEventListener("drop", async (e) => {
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
        if (files.length === 0) return;
        
        let category = (currentFilter === 'all' || currentFilter === 'favorites') ? 'Friends' : currentFilter;
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                const photoData = await compressImage(file, 1280, 0.8);
                await fetch('/api/photos', {
                    method: 'POST',
                    headers: await getAuthHeaders(),
                    body: JSON.stringify({
                        src: photoData,
                        category: category,
                        favorite: false,
                        title: "",
                        story: "",
                        color: "#ffffff",
                        fontColor: "#334155"
                    })
                });
                addNotification(`Successfully uploaded ${file.name}`);
            } catch (error) { 
                console.error(error); 
                addNotification(`Failed to upload ${file.name}`);
            }
        }
        loadPhotos();
    });
}

// --- Theme ---

async function applyGlobalTheme() {
    const color = document.getElementById("globalPolaroidColor").value;
    const fontColor = document.getElementById("globalFontColor").value;

    if (!confirm("Apply this theme to all photos?")) return;

    try {
        await fetch('/api/photos/bulk/colors', {
            method: 'PUT',
            headers: await getAuthHeaders(),
            body: JSON.stringify({ color, fontColor })
        });
        loadPhotos();
    } catch (error) { console.error(error); }
}

// --- UI Helpers ---

function createPolaroid(src, category, favorite, title, color, fColor, id, isTrash){
    let wall = document.getElementById("mainWall");
    let box = document.createElement("div");
    box.className = "polaroid";
    box.setAttribute('data-id', id);
    box.style.backgroundColor = color || "#ffffff";
    if(favorite) box.classList.add("favorite");
    if(selectedForPrint.includes(id)) {
        box.classList.add("selected-for-print");
        let num = document.createElement("div");
        num.className = "selection-number";
        num.innerText = selectedForPrint.indexOf(id) + 1;
        box.appendChild(num);
    }

    let img = document.createElement("img");
    img.loading = "lazy";
    img.src = src;

    let caption = document.createElement("div");
    caption.className = "caption";
    caption.innerText = title || "";
    caption.style.color = fColor || "#334155";

    if (!isTrash) {
        img.onclick = async () => {
            if (isPrintMode) {
                // Toggle selection for print
                const limit = parseInt(document.getElementById("printTemplate").value);
                const idx = selectedForPrint.indexOf(id);
                if (idx > -1) {
                    selectedForPrint.splice(idx, 1);
                    box.classList.remove("selected-for-print");
                    const existingNum = box.querySelector('.selection-number');
                    if (existingNum) existingNum.remove();
                    refreshSelectionNumbers();
                    updateSelectionLimit();
                } else {
                    if (selectedForPrint.length < limit) {
                        selectedForPrint.push(id);
                        box.classList.add("selected-for-print");
                        let num = document.createElement("div");
                        num.className = "selection-number";
                        num.innerText = selectedForPrint.length;
                        box.appendChild(num);
                        updateSelectionLimit();
                    } else {
                        alert(`You can only select up to ${limit} photos for this batch.`);
                    }
                }
                return;
            }
            modal.style.display = "flex";
            setTimeout(() => modal.classList.add("active"), 10);
            modalImg.src = src;
            currentId = id;
            currentPolaroid = box;
            currentCaption = caption;

            const photo = allPhotos.find(p => p.id === id);
            editTitle.value = photo.title || "";
            polaroidColor.value = photo.color || "#ffffff";
            fontColor.value = photo.fontColor || "#334155";
            storyInput.value = photo.story || "";
            favBtn.classList.toggle("is-fav", photo.favorite === 1);
        };
    }

    let del = document.createElement("button");
    del.className = "delete";
    if (isTrash) {
        del.innerHTML = '<i class="icon-restore"></i>';
        del.title = "Restore Photo";
        del.onclick = async (e) => {
            e.stopPropagation();
            await fetch(`/api/photos/${id}/restore`, { 
                method: 'POST',
                headers: await getAuthHeaders()
            });
            toggleTrashBin(); toggleTrashBin(); // Refresh
        };
    } else {
        del.innerHTML = '<i class="icon-trash"></i>';
        del.title = "Move to Trash";
        del.onclick = async (e) => {
            e.stopPropagation();
            await fetch(`/api/photos/${id}`, { 
                method: 'DELETE',
                headers: await getAuthHeaders()
            });
            loadPhotos();
        };
    }

    box.appendChild(img);
    box.appendChild(caption);
    box.appendChild(del);
    wall.appendChild(box);
}

saveStory.onclick = async () => {
    const photo = allPhotos.find(p => p.id === currentId);
    try {
        await fetch(`/api/photos/${currentId}`, {
            method: 'PUT',
            headers: await getAuthHeaders(),
            body: JSON.stringify({
                title: editTitle.value,
                story: storyInput.value,
                color: polaroidColor.value,
                fontColor: fontColor.value,
                favorite: favBtn.classList.contains("is-fav")
            })
        });
        closeModal();
        loadPhotos();
    } catch (error) { console.error(error); }
};

favBtn.onclick = () => favBtn.classList.toggle("is-fav");

const sortSelect = document.getElementById("sortSelect");
if (sortSelect) sortSelect.onchange = renderWall;

function closeModal() {
    modal.classList.remove("active");
    setTimeout(() => {
        if (!modal.classList.contains("active")) {
            modal.style.display = "none";
        }
    }, 300);
}

function downloadImage() {
    const link = document.createElement('a');
    link.href = modalImg.src;
    link.download = `polaroid-${currentId}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addNotification(`Downloaded photo ${currentId}`);
}

searchInput.oninput = renderWall;

window.onscroll = () => {
    scrollTopBtn.style.display = (window.scrollY > 200) ? "flex" : "none";
};

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        let reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function compressImage(file, maxDim, quality) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                let width = img.width;
                let height = img.height;
                if (width > height && width > maxDim) {
                    height = Math.round(height * (maxDim / width));
                    width = maxDim;
                } else if (height > maxDim) {
                    width = Math.round(width * (maxDim / height));
                    height = maxDim;
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = reject;
            img.src = reader.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
