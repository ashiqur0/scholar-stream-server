
---

# 📕 Server Side – `README.md`

```md
<div align="center">

# 🛠️ ScholarStream – Server Side  
### Scholarship Management Platform (Backend)

🌐 **API Base URL:** https://scholar-strem-server-by-ashiqur.vercel.app/ 
📁 **Repository Type:** Server / Backend  
🧑‍💻 **Tech Stack:** MERN (Backend)

</div>

---

## 🧠 Project Purpose

The server-side of **ScholarStream** powers authentication, data management, payments, and role-based authorization using a secure and scalable REST API.

---

## ⚙️ Core Responsibilities

- User authentication & role management
- Scholarship CRUD operations
- Application processing
- Review moderation
- Secure Stripe payment handling
- Server-side search, filter, sort & pagination
- JWT-protected APIs

---

## 🗂️ Database Collections

### 👤 Users
- name
- email
- photoURL
- role (Student / Moderator / Admin)

### 🎓 Scholarships
- scholarshipName
- universityName
- universityImage
- country, city, worldRank
- subjectCategory
- scholarshipCategory
- degree
- tuitionFees
- applicationFees
- serviceCharge
- deadline
- postDate
- postedUserEmail

### 📝 Applications
- scholarshipId
- userId
- userName
- userEmail
- applicationStatus
- paymentStatus
- feedback
- applicationDate

### ⭐ Reviews
- scholarshipId
- universityName
- userName
- userEmail
- rating
- comment
- reviewDate

---

## 🔐 Authentication & Authorization

- JWT token-based authentication
- Secure middleware protection
- Role-based access control

### Middleware
- `verifyToken`
- `verifyAdmin`
- `verifyModerator`

---

## 🔍 Advanced Features

✔ Server-side search (Name, University, Degree)  
✔ Server-side filter (Country, Category)  
✔ Server-side sort (Fees, Post Date)  
✔ Pagination for scalability  

---

## 💳 Payment System

- Stripe Payment Gateway
- Secure intent creation
- Payment success & failure handling
- Payment retry supported

---

## 📦 NPM Packages

```bash
express
cors
mongodb
jsonwebtoken
dotenv
stripe
