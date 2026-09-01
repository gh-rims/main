/**
 * ================================================================================
 * مشروع نظام وسائط الغامدي - ملف البرمجة الأمامية الموحد (app.js)
 * ================================================================================
 */

// 1. رابط الـ Web App المنشور من Google Apps Script
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz7pxrAouLjfHObWcuI9g7PHk3LAU9wH3C29i7kvLq1okWHulqtes-Sm2JJd4OVax1syw/exec";

// 2. المتغيرات العامة للجلسة والوسائط
let currentUser = null;
let currentMediaToMove = null;
let currentFolderMediaCache = {};

// ==========================================
// 3. دوال التهيئة وإدارة الجلسة عند التحميل
// ==========================================
document.addEventListener("DOMContentLoaded", function () {
  checkSession();
  setupEventListeners();
});

/**
 * التحقق من وجود جلسة مسجلة في التخزين المحلي (localStorage)
 */
function checkSession() {
  const savedUserJson = localStorage.getItem("ghamdi_media_user");
  
  if (savedUserJson) {
    try {
      currentUser = JSON.parse(savedUserJson);
      // التحقق من صلاحية الجلسة وحالة الحظر من الخادم مباشرة
      validateSessionOnServer(currentUser.Username, currentUser.Password);
    } catch (e) {
      clearSessionAndShowLogin();
    }
  } else {
    clearSessionAndShowLogin();
  }
}

/**
 * التحقق من الجلسة عبر الخادم لتأكيد عدم الحظر أو تغيير كلمة المرور
 */
function validateSessionOnServer(username, password) {
  fetchAPI({
    action: "validateSession",
    username: username,
    password: password
  }).then(response => {
    if (response && response.success) {
      currentUser = response.user;
      localStorage.setItem("ghamdi_media_user", JSON.stringify(currentUser));
      initUIByUserRole();
    } else {
      alert(response.message || "تغيرت حالة الحساب أو كلمة المرور. يرجى إعادة تسجيل الدخول.");
      clearSessionAndShowLogin();
    }
  }).catch(err => {
    console.error("خطأ أثناء التحقق من الجلسة:", err);
    // في حال خطأ في الشبكة نسحب البيانات المخزنة محلياً مؤقتاً
    if (currentUser) initUIByUserRole();
    else clearSessionAndShowLogin();
  });
}

function clearSessionAndShowLogin() {
  localStorage.removeItem("ghamdi_media_user");
  currentUser = null;
  
  const loginModal = document.getElementById("loginModal");
  if (loginModal) {
    loginModal.classList.remove("hidden");
  }
}

/**
 * تهيئة عناصر الواجهة بحسب صلاحيات المستخدم المعنية
 */
function initUIByUserRole() {
  const loginModal = document.getElementById("loginModal");
  if (loginModal) loginModal.classList.add("hidden");

  // تحديث الاسم الظاهر
  const userDisplayElem = document.getElementById("userDisplayName");
  if (userDisplayElem && currentUser) {
    userDisplayElem.textContent = currentUser.DisplayName;
  }

  // رابط لوحة التحكم (للمدير فقط)
  const controlLink = document.getElementById("controlPageLink");
  if (controlLink) {
    if (currentUser.Role === "ADMIN") {
      controlLink.classList.remove("hidden");
    } else {
      controlLink.classList.add("hidden");
    }
  }

  // التحكم بشاشة الرئيسية (index.html)
  if (document.getElementById("uploadSection")) {
    // قسم الرفع: فقط إذا كان مصرحاً له بالرفع
    const uploadSection = document.getElementById("uploadSection");
    if (currentUser.CanUpload || currentUser.Role === "ADMIN") {
      uploadSection.classList.remove("hidden");
    } else {
      uploadSection.classList.add("hidden");
    }

    // إظهار وإخفاء المعارض بحسب الأذونات
    if (currentUser.ShowPublish || currentUser.Role === "ADMIN") {
      document.getElementById("sectionGalleryPublish")?.classList.remove("hidden");
    }
    if (currentUser.ShowDesign || currentUser.Role === "ADMIN") {
      document.getElementById("sectionGalleryDesign")?.classList.remove("hidden");
    }
    if (currentUser.ShowOld || currentUser.Role === "ADMIN") {
      document.getElementById("sectionGalleryOld")?.classList.remove("hidden");
    }

    // إشعار وسجلات النشاطات (للمدير فقط)
    if (currentUser.Role === "ADMIN") {
      document.getElementById("activityLogSection")?.classList.remove("hidden");
      loadActivityLogs();
    }

    // جلب كافة وسائط المعارض
    loadAllGalleries();
  }

  // التحكم بصفحة لوحة التحكم (control.html)
  if (document.getElementById("usersListContainer")) {
    if (currentUser.Role !== "ADMIN") {
      alert("عذراً، هذه الصفحة مخصصة لمدير النظام فقط.");
      window.location.href = "index.html";
      return;
    }
    loadControlUsersList();
  }
}

// ==========================================
// 4. إعداد المشتتات والضغطات (Event Listeners)
// ==========================================
function setupEventListeners() {
  // قائمة "ملف" المنسدلة
  const fileMenuBtn = document.getElementById("fileMenuBtn");
  const fileDropdownContent = document.getElementById("fileDropdownContent");
  if (fileMenuBtn && fileDropdownContent) {
    fileMenuBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      fileDropdownContent.classList.toggle("hidden");
    });
    document.addEventListener("click", function () {
      fileDropdownContent.classList.add("hidden");
    });
  }

  // تسجيل الخروج
  document.getElementById("logoutBtn")?.addEventListener("click", function (e) {
    e.preventDefault();
    clearSessionAndShowLogin();
  });

  // نموذج تسجيل الدخول
  document.getElementById("loginForm")?.addEventListener("submit", function (e) {
    e.preventDefault();
    const u = document.getElementById("loginUsername").value.trim();
    const p = document.getElementById("loginPassword").value.trim();
    const errMsg = document.getElementById("loginErrorMessage");

    if (!u || !p) return;

    fetchAPI({
      action: "login",
      username: u,
      password: p
    }).then(res => {
      if (res && res.success) {
        currentUser = res.user;
        localStorage.setItem("ghamdi_media_user", JSON.stringify(currentUser));
        if (errMsg) errMsg.classList.add("hidden");
        initUIByUserRole();
      } else {
        if (errMsg) {
          errMsg.textContent = res.message || "اسم المستخدم أو كلمة المرور غير صحيحة";
          errMsg.classList.remove("hidden");
        }
      }
    });
  });

  // معالجة رفع الملفات من الاستوديو
  setupUploadInput("inputDesignImages", "DESIGN_IMAGES");
  setupUploadInput("inputDesignVideos", "DESIGN_VIDEOS");
  setupUploadInput("inputPublishImages", "PUBLISH_IMAGES");
  setupUploadInput("inputPublishVideos", "PUBLISH_VIDEOS");

  // نافذة معاينة الصور والفيديو
  document.getElementById("closePreviewBtn")?.addEventListener("click", function () {
    document.getElementById("previewModal")?.classList.add("hidden");
    const holder = document.getElementById("previewContentHolder");
    if (holder) holder.innerHTML = "";
  });

  // نافذة نقل الوسائط العامة
  document.getElementById("cancelMoveBtn")?.addEventListener("click", function () {
    document.getElementById("moveMediaModal")?.classList.add("hidden");
    currentMediaToMove = null;
  });

  document.getElementById("confirmMoveBtn")?.addEventListener("click", function () {
    const targetFolder = document.getElementById("targetFolderSelect").value;
    if (currentMediaToMove && targetFolder) {
      executeMediaMove(currentMediaToMove, targetFolder);
    }
  });

  // نافذة تفاصيل الهاشتاق لمجلد التواصل الاجتماعي
  document.getElementById("cancelSocialMetaBtn")?.addEventListener("click", function () {
    document.getElementById("socialMetaModal")?.classList.add("hidden");
    currentMediaToMove = null;
  });

  document.getElementById("confirmSocialMetaBtn")?.addEventListener("click", function () {
    const publishInfo = document.getElementById("metaPublishInfo").value.trim();
    const titleHashtag = document.getElementById("metaTitleHashtag").value.trim();
    
    if (currentMediaToMove) {
      executeMediaMove(currentMediaToMove, "SOCIAL", titleHashtag, publishInfo);
    }
  });

  // نموذج إضافة مشترك جديد (في صفحة control.html)
  document.getElementById("addUserForm")?.addEventListener("submit", function (e) {
    e.preventDefault();
    addNewUserHandler();
  });
}

// ==========================================
// 5. جلب وتحديث وسائط المعارض المعروضة
// ==========================================
function loadAllGalleries() {
  const folderKeys = [
    "PUBLISH_IMAGES", "PUBLISH_VIDEOS", "STATUSES", "SOCIAL",
    "DESIGN_IMAGES", "DESIGN_VIDEOS", "OLD_IMAGES", "OLD_VIDEOS"
  ];

  folderKeys.forEach(folderKey => {
    fetchFolderMedia(folderKey);
  });
}

function fetchFolderMedia(folderKey) {
  const container = document.getElementById(`container${folderKey}`);
  if (!container) return;

  container.innerHTML = `<div class="media-meta-text">جاري التحميل...</div>`;

  fetchAPI({
    action: "fetchFolderMedia",
    folderKey: folderKey
  }).then(res => {
    if (res && res.success) {
      currentFolderMediaCache[folderKey] = res.files || [];
      renderFolderMediaGrid(folderKey, res.files || []);
    } else {
      container.innerHTML = `<div class="media-meta-text">تعذر جلب المحتوى.</div>`;
    }
  });
}

/**
 * رسم بطاقات الوسائط داخل الصفحات المحددة (5 عناصر + زر المزيد)
 */
function renderFolderMediaGrid(folderKey, files) {
  const container = document.getElementById(`container${folderKey}`);
  if (!container) return;

  container.innerHTML = "";

  if (files.length === 0) {
    container.innerHTML = `<div class="media-meta-text">لا توجد وسائط في هذا المجلد حالياً.</div>`;
    return;
  }

  // عرض أول 5 عناصر ثم زر المزيد إذا تجاوزت 5
  const initialDisplayLimit = 5;
  const filesToRender = files.slice(0, initialDisplayLimit);

  filesToRender.forEach(file => {
    const cardElem = createMediaCardElement(file, folderKey);
    container.appendChild(cardElem);
  });

  if (files.length > initialDisplayLimit) {
    const moreBtn = document.createElement("button");
    moreBtn.className = "btn btn-secondary";
    moreBtn.style.alignSelf = "center";
    moreBtn.style.minWidth = "80px";
    moreBtn.textContent = `المزيد (+${files.length - initialDisplayLimit})`;
    moreBtn.onclick = function () {
      container.innerHTML = "";
      files.forEach(file => {
        container.appendChild(createMediaCardElement(file, folderKey));
      });
    };
    container.appendChild(moreBtn);
  }
}

/**
 * بناء بطاقة وسيط مربع متوافق مع كافة الشروط
 */
function createMediaCardElement(file, folderKey) {
  const card = document.createElement("div");
  card.className = "media-card";

  // 1. فحص الشارة المضيئة تلقائياً (عمر أقل من 24 ساعة)
  const isNew = checkIsNewFile(file.createdDate);
  if (isNew) {
    const badge = document.createElement("span");
    badge.className = "badge-new";
    badge.textContent = "🔥 جديد";
    card.appendChild(badge);
  }

  // 2. صندوق المعاينة (ضغط مزدوج للمعاينة)
  const previewBox = document.createElement("div");
  previewBox.className = "media-preview-box";
  
  if (file.mimeType.startsWith("image/")) {
    const img = document.createElement("img");
    img.src = file.thumbnailUrl || file.downloadUrl;
    img.alt = file.name;
    previewBox.appendChild(img);
  } else if (file.mimeType.startsWith("video/")) {
    const video = document.createElement("video");
    video.src = file.downloadUrl;
    previewBox.appendChild(video);
  }

  previewBox.ondblclick = function () {
    openPreviewModal(file);
  };

  card.appendChild(previewBox);

  // 3. التفاصيل تحت الوسيط مباشرة
  const details = document.createElement("div");
  details.className = "media-details";
  details.innerHTML = `
    <div class="media-name" title="${file.name}">${file.name}</div>
    <div class="media-meta-text">تاريخ الرفع: ${file.formattedDate || "غير محدد"}</div>
    <div class="media-meta-text">الرافع: ${file.uploader || "الغامدي"}</div>
  `;
  card.appendChild(details);

  // 4. مربع النص الخاص بالهاشتاق لمجلد التواصل الاجتماعي
  if (folderKey === "SOCIAL" && file.metaData) {
    const socialBox = document.createElement("div");
    socialBox.className = "social-meta-display";
    socialBox.innerHTML = `
      <textarea readonly class="meta-textarea-readonly" onclick="this.select();">${file.metaData.titleHashtag || ""}</textarea>
    `;
    card.appendChild(socialBox);
  }

  // 5. الأزرار الأربعة المباشرة: [تنزيل] [نقل] [حذف] [مشاركة]
  const actionsGrid = document.createElement("div");
  actionsGrid.className = "media-actions-grid";

  // زر تنزيل
  const dlBtn = document.createElement("button");
  dlBtn.className = "btn-card-action btn-secondary";
  dlBtn.textContent = "تنزيل";
  dlBtn.onclick = function () { handleDownload(file); };

  // زر نقل
  const mvBtn = document.createElement("button");
  mvBtn.className = "btn-card-action btn-secondary";
  mvBtn.textContent = "نقل";
  mvBtn.onclick = function () { openMoveModal(file); };

  // زر حذف
  const delBtn = document.createElement("button");
  delBtn.className = "btn-card-action btn-secondary";
  delBtn.style.color = "#ef4444";
  delBtn.textContent = "حذف";
  delBtn.onclick = function () { handleDelete(file, folderKey); };

  // زر مشاركة عبر واتساب
  const shareBtn = document.createElement("button");
  shareBtn.className = "btn-card-action btn-secondary";
  shareBtn.textContent = "واتساب";
  shareBtn.onclick = function () { handleWhatsAppShare(file); };

  actionsGrid.appendChild(dlBtn);
  actionsGrid.appendChild(mvBtn);
  actionsGrid.appendChild(delBtn);
  actionsGrid.appendChild(shareBtn);

  // 6. زر تبديل الحالة الفرعية المعزز باللون
  if (["PUBLISH_IMAGES", "PUBLISH_VIDEOS", "STATUSES", "SOCIAL"].includes(folderKey)) {
    const statusBtn = document.createElement("button");
    const isDone = file.statusFlag === "DONE";
    statusBtn.className = `btn-card-action btn-status-toggle ${isDone ? 'btn-status-white' : 'btn-status-orange'}`;
    statusBtn.textContent = isDone ? "تم النشر" : "جاهز للنشر";
    statusBtn.onclick = function () { toggleMediaStatus(file, folderKey); };
    actionsGrid.appendChild(statusBtn);
  } else if (["DESIGN_IMAGES", "DESIGN_VIDEOS"].includes(folderKey)) {
    const statusBtn = document.createElement("button");
    const isDone = file.statusFlag === "EDITED";
    statusBtn.className = `btn-card-action btn-status-toggle ${isDone ? 'btn-status-white' : 'btn-status-orange'}`;
    statusBtn.textContent = isDone ? "تم التعديل" : "جديد للتعديل";
    statusBtn.onclick = function () { toggleMediaStatus(file, folderKey); };
    actionsGrid.appendChild(statusBtn);
  }

  card.appendChild(actionsGrid);
  return card;
}

/**
 * حساب عمر الملف لتفعيل شارة 🔥 جديد تلقائياً إذا كان أقل من 24 ساعة
 */
function checkIsNewFile(createdDateStr) {
  if (!createdDateStr) return false;
  const createdTime = new Date(createdDateStr).getTime();
  const now = new Date().getTime();
  const hoursDiff = (now - createdTime) / (1000 * 60 * 60);
  return hoursDiff <= 24;
}

// ==========================================
// 6. عمليات الرفع والنقل والحذف والتشارك
// ==========================================

/**
 * معالجة اختيار الملفات ورفعها بشريط تقدم تفاعلي
 */
function setupUploadInput(inputId, folderKey) {
  const inputElem = document.getElementById(inputId);
  if (!inputElem) return;

  inputElem.addEventListener("change", async function (e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const progressContainer = document.getElementById("uploadProgressContainer");
    const progressBar = document.getElementById("uploadProgressBar");
    const statusText = document.getElementById("uploadStatusText");
    const percentText = document.getElementById("uploadPercentageText");

    if (progressContainer) progressContainer.classList.remove("hidden");

    let completedCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (statusText) statusText.textContent = `جاري رفع الملف (${i + 1} من ${files.length}): ${file.name}`;

      try {
        const base64Data = await readFileAsBase64(file);
        
        const res = await fetchAPI({
          action: "uploadFile",
          folderKey: folderKey,
          fileName: file.name,
          mimeType: file.type,
          base64Data: base64Data,
          username: currentUser ? currentUser.Username : "Adham"
        });

        if (res && res.success) {
          completedCount++;
        }
      } catch (err) {
        console.error("خطأ أثناء الرفع:", err);
      }

      const percent = Math.round(((i + 1) / files.length) * 100);
      if (progressBar) progressBar.style.width = `${percent}%`;
      if (percentText) percentText.textContent = `${percent}%`;
    }

    if (statusText) statusText.textContent = "تم اكتمال رفع جميع الملفات بنجاح!";
    setTimeout(() => {
      if (progressContainer) progressContainer.classList.add("hidden");
      if (progressBar) progressBar.style.width = "0%";
      inputElem.value = "";
      fetchFolderMedia(folderKey);
    }, 1500);
  });
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

/**
 * فتح نافذة النقل
 */
function openMoveModal(file) {
  if (!currentUser.CanMove && currentUser.Role !== "ADMIN") {
    alert("ليس لديك صلاحية لنقل الوسائط.");
    return;
  }
  currentMediaToMove = file;
  document.getElementById("moveMediaModal")?.classList.remove("hidden");
}

function executeMediaMove(file, targetFolder, titleHashtag = "", publishInfo = "") {
  document.getElementById("moveMediaModal")?.classList.add("hidden");
  document.getElementById("socialMetaModal")?.classList.add("hidden");

  fetchAPI({
    action: "moveMedia",
    fileId: file.id,
    targetFolderKey: targetFolder,
    titleHashtag: titleHashtag,
    publishInfo: publishInfo,
    username: currentUser ? currentUser.Username : "Adham"
  }).then(res => {
    if (res && res.success) {
      alert("تم نقل الملف بنجاح.");
      loadAllGalleries();
    } else {
      alert("حدث خطأ أثناء نقل الملف.");
    }
    currentMediaToMove = null;
  });
}

/**
 * حذف الوسيط
 */
function handleDelete(file, folderKey) {
  if (!currentUser.CanDelete && currentUser.Role !== "ADMIN") {
    alert("ليس لديك صلاحية لحذف الوسائط.");
    return;
  }
  if (!confirm(`هل أنت تأكد من نقل الملف (${file.name}) إلى سلة المهملات؟`)) return;

  fetchAPI({
    action: "deleteMedia",
    fileId: file.id,
    username: currentUser ? currentUser.Username : "Adham"
  }).then(res => {
    if (res && res.success) {
      alert("تم حذف الملف بنجاح.");
      fetchFolderMedia(folderKey);
    } else {
      alert("تعذر حذف الملف.");
    }
  });
}

/**
 * تنزيل الوسيط ومشاركة النصوص
 */
function handleDownload(file) {
  if (file.metaData && file.metaData.titleHashtag) {
    navigator.clipboard.writeText(file.metaData.titleHashtag).then(() => {
      alert("تم نسخ الوصف والهاشتاق تلقائياً إلى الحافظة، وجاري بدء تنزيل الملف...");
    });
  }
  window.open(file.downloadUrl, '_blank');
}

/**
 * مشاركة عبر الواتساب رابط مباشر
 */
function handleWhatsAppShare(file) {
  let text = `وسائط الغامدي: ${file.name}\n${file.downloadUrl}`;
  if (file.metaData && file.metaData.titleHashtag) {
    text += `\n\n${file.metaData.titleHashtag}`;
  }
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

/**
 * التبديل بين حالات النشر والتعديل
 */
function toggleMediaStatus(file, folderKey) {
  let newStatus = "PENDING";
  if (file.statusFlag === "DONE") newStatus = "PENDING";
  else if (file.statusFlag === "EDITED") newStatus = "PENDING";
  else if (["PUBLISH_IMAGES", "PUBLISH_VIDEOS", "STATUSES", "SOCIAL"].includes(folderKey)) newStatus = "DONE";
  else newStatus = "EDITED";

  fetchAPI({
    action: "updateMediaStatus",
    fileId: file.id,
    statusFlag: newStatus,
    username: currentUser ? currentUser.Username : "Adham"
  }).then(res => {
    if (res && res.success) {
      fetchFolderMedia(folderKey);
    }
  });
}

/**
 * فتح نافذة التكبير والمعاينة
 */
function openPreviewModal(file) {
  const modal = document.getElementById("previewModal");
  const holder = document.getElementById("previewContentHolder");
  if (!modal || !holder) return;

  holder.innerHTML = "";
  if (file.mimeType.startsWith("image/")) {
    const img = document.createElement("img");
    img.src = file.downloadUrl;
    holder.appendChild(img);
  } else if (file.mimeType.startsWith("video/")) {
    const video = document.createElement("video");
    video.src = file.downloadUrl;
    video.controls = true;
    video.autoplay = true;
    holder.appendChild(video);
  }
  modal.classList.remove("hidden");
}

// ==========================================
// 7. إشعارات وسجلات النظام (للمدير)
// ==========================================
function loadActivityLogs() {
  const tbody = document.getElementById("activityLogTableBody");
  if (!tbody) return;

  fetchAPI({ action: "getRecentLogs" }).then(res => {
    if (res && res.success && res.logs) {
      tbody.innerHTML = "";
      if (res.logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center">لا توجد عمليات مسجلة حديثاً.</td></tr>`;
        return;
      }
      res.logs.forEach(log => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${log.timestamp}</td>
          <td>${log.username}</td>
          <td>${log.actionType}</td>
          <td>${log.details}</td>
          <td>${log.mediaName}</td>
        `;
        tbody.appendChild(tr);
      });
    }
  });
}

// ==========================================
// 8. لوحة التحكم وإدارة المشتركين (control.html)
// ==========================================
function loadControlUsersList() {
  const container = document.getElementById("usersListContainer");
  if (!container) return;

  fetchAPI({ action: "getAllUsers" }).then(res => {
    if (res && res.success) {
      renderControlUsersAccordion(res.users);
    } else {
      container.innerHTML = `<div class="media-meta-text">تعذر تحميل المشتركين.</div>`;
    }
  });
}

function renderControlUsersAccordion(users) {
  const container = document.getElementById("usersListContainer");
  if (!container) return;

  container.innerHTML = "";
  users.forEach(user => {
    if (user.Role === "ADMIN") return; // استثناء المدير من قائمة الحظر والتحكم الفرعية

    const item = document.createElement("div");
    item.className = "user-accordion-item";

    const isBlocked = user.Status === "BLOCKED";

    item.innerHTML = `
      <div class="user-accordion-header" onclick="this.nextElementSibling.classList.toggle('hidden')">
        <span><strong>${user.DisplayName}</strong> (${user.Username}) - <small style="color:${isBlocked ? '#ef4444' : '#10b981'}">${isBlocked ? 'محظور' : 'نشط'}</small></span>
        <span>▼</span>
      </div>
      <div class="user-accordion-body hidden">
        <div class="form-group">
          <button class="btn ${isBlocked ? 'btn-orange' : 'btn-secondary'}" onclick="toggleUserBlockStatus('${user.Username}', '${isBlocked ? 'ACTIVE' : 'BLOCKED'}')">
            ${isBlocked ? 'إيقاف الحظر' : 'حظر المشترك'}
          </button>
        </div>
        <hr class="menu-divider">
        <div class="form-group">
          <label><strong>أذونات وتصاريح المشترك:</strong></label>
          <div class="checkbox-group">
            <label class="checkbox-label"><input type="checkbox" ${user.CanUpload ? 'checked' : ''} onchange="updateUserPerm('${user.Username}', 'CanUpload', this.checked)"> الرفع</label>
            <label class="checkbox-label"><input type="checkbox" ${user.CanDelete ? 'checked' : ''} onchange="updateUserPerm('${user.Username}', 'CanDelete', this.checked)"> الحذف</label>
            <label class="checkbox-label"><input type="checkbox" ${user.CanMove ? 'checked' : ''} onchange="updateUserPerm('${user.Username}', 'CanMove', this.checked)"> النقل</label>
            <label class="checkbox-label"><input type="checkbox" ${user.CanShare ? 'checked' : ''} onchange="updateUserPerm('${user.Username}', 'CanShare', this.checked)"> المشاركة</label>
          </div>
        </div>
        <hr class="menu-divider">
        <div class="form-group">
          <label><strong>إظهار / إخفاء المعارض للمشترك:</strong></label>
          <div class="checkbox-group">
            <label class="checkbox-label"><input type="checkbox" ${user.ShowPublish ? 'checked' : ''} onchange="updateUserPerm('${user.Username}', 'ShowPublish', this.checked)"> معرض وسائط للنشر</label>
            <label class="checkbox-label"><input type="checkbox" ${user.ShowDesign ? 'checked' : ''} onchange="updateUserPerm('${user.Username}', 'ShowDesign', this.checked)"> معرض وسائط للتصميم</label>
            <label class="checkbox-label"><input type="checkbox" ${user.ShowOld ? 'checked' : ''} onchange="updateUserPerm('${user.Username}', 'ShowOld', this.checked)"> معرض وسائط قديمة</label>
          </div>
        </div>
        <div style="text-align: left;">
          <button class="btn btn-secondary nav-back-btn" onclick="this.parentElement.parentElement.classList.add('hidden')">تصغير</button>
        </div>
      </div>
    `;
    container.appendChild(item);
  });
}

function addNewUserHandler() {
  const username = document.getElementById("newUsername").value.trim();
  const displayName = document.getElementById("newDisplayName").value.trim();
  const password = document.getElementById("newPassword").value.trim();
  const msgElem = document.getElementById("addUserMessage");

  if (!username || !displayName || !password) {
    alert("يرجى ملء كافة الحقول الثلاثة المطلوبة.");
    return;
  }

  fetchAPI({
    action: "addNewUser",
    username: username,
    displayName: displayName,
    password: password
  }).then(res => {
    if (res && res.success) {
      if (msgElem) {
        msgElem.textContent = "تم إضافة المشترك بنجاح!";
        msgElem.classList.remove("hidden");
      }
      document.getElementById("newUsername").value = "";
      document.getElementById("newDisplayName").value = "";
      document.getElementById("newPassword").value = "";
      loadControlUsersList();
    } else {
      alert(res.message || "فشلت عملية الإضافة (قد يكون اسم المشترك أو الاسم الظاهر مستخدماً مسبقاً).");
    }
  });
}

function toggleUserBlockStatus(username, newStatus) {
  fetchAPI({
    action: "updateUserStatus",
    targetUsername: username,
    newStatus: newStatus
  }).then(res => {
    if (res && res.success) {
      loadControlUsersList();
    }
  });
}

function updateUserPerm(username, permField, permValue) {
  fetchAPI({
    action: "updateUserPermissions",
    targetUsername: username,
    field: permField,
    value: permValue
  });
}

// ==========================================
// 9. دالة الاتصال المباشر بـ Google Apps Script (AJAX API)
// ==========================================
function fetchAPI(data) {
  return fetch(SCRIPT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(data)
  })
  .then(response => response.json())
  .catch(error => {
    console.error("خطأ في الاتصال بالخادم:", error);
    return { success: false, message: "تعذر الاتصال بالخادم." };
  });
}
