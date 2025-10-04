import os, base64, requests, getpass

# طلب بيانات من المستخدم
GITHUB_USER = input("👤 أدخل اسم حسابك على GitHub: ").strip()
TOKEN = getpass.getpass("🔑 أدخل Personal Access Token: ").strip()
REPO = input("📦 اسم المستودع (مثلاً ghadeer-logistics-site): ").strip()

BASE_URL = f"https://api.github.com/repos/{GITHUB_USER}/{REPO}"
AUTH = (GITHUB_USER, TOKEN)

print("""
🔧 اختر العملية:
1️⃣ رفع/تحديث الملفات (Upload/Update)
2️⃣ حذف المستودع بالكامل (Delete Repo)
3️⃣ تعطيل GitHub Pages (Disable Pages)
""")
choice = input("➡️ أدخل الرقم: ").strip()

# -------------------------------------------
# رفع/تحديث الملفات
# -------------------------------------------
if choice == "1":
    resp = requests.get(BASE_URL, auth=AUTH)

    if resp.status_code == 404:
        print("📦 المستودع غير موجود. يتم إنشاؤه...")
        create = requests.post("https://api.github.com/user/repos", auth=AUTH,
                               json={"name": REPO, "private": False})
        if create.status_code not in [200,201]:
            print("❌ خطأ في إنشاء المستودع:", create.status_code, create.text)
            exit()
        print("✅ تم إنشاء المستودع:", create.json().get("html_url"))
    else:
        print("♻️ المستودع موجود. سيتم تحديث الملفات.")

    path = "ghadeer-logistics-site-static"
    for root, dirs, files in os.walk(path):
        for file in files:
            full_path = os.path.join(root, file)
            rel_path = os.path.relpath(full_path, path).replace("\\","/")
            with open(full_path, "rb") as f:
                content = base64.b64encode(f.read()).decode("utf-8")

            url = f"{BASE_URL}/contents/{rel_path}"
            check = requests.get(url, auth=AUTH)
            sha = check.json().get("sha") if check.status_code == 200 else None

            payload = {"message": f"Update {rel_path}",
                       "content": content}
            if sha:
                payload["sha"] = sha

            resp = requests.put(url, auth=AUTH, json=payload)
            print(("🔄 تحديث" if sha else "➕ رفع"), rel_path, "=>", resp.status_code)

    pages_url = f"{BASE_URL}/pages"
    resp = requests.post(pages_url, auth=AUTH,
                         json={"source": {"branch": "main", "path": "/"}})
    if resp.status_code in [200,201]:
        print("✅ تم تفعيل GitHub Pages")
    else:
        print("ℹ️ إذا ما اتفعل تلقائياً، فعّله من Settings > Pages")

    print(f"🌍 موقعك: https://{GITHUB_USER}.github.io/{REPO}/")

# -------------------------------------------
# حذف المستودع
# -------------------------------------------
elif choice == "2":
    confirm = input(f"⚠️ هل أنت متأكد أنك تريد حذف المستودع {REPO}? (yes/no): ")
    if confirm.lower() == "yes":
        resp = requests.delete(BASE_URL, auth=AUTH)
        if resp.status_code == 204:
            print("🗑️ تم حذف المستودع بنجاح.")
        else:
            print("❌ خطأ في الحذف:", resp.status_code, resp.text)
    else:
        print("🚫 إلغاء العملية.")

# -------------------------------------------
# تعطيل GitHub Pages
# -------------------------------------------
elif choice == "3":
    pages_url = f"{BASE_URL}/pages"
    resp = requests.delete(pages_url, auth=AUTH)
    if resp.status_code in [204,200]:
        print("🚫 تم تعطيل GitHub Pages.")
    else:
        print("❌ خطأ في تعطيل Pages:", resp.status_code, resp.text)

else:
    print("🚫 خيار غير صحيح.")
