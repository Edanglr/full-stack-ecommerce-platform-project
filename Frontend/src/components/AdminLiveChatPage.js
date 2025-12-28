import React, { useEffect, useState } from "react";
import SupportChat from "./chat/SupportChat";

function AdminLiveChatPage({ user }) {
  const [activeChats, setActiveChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [customerDetails, setCustomerDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  /* ================================
     1️⃣ Chat Listesi (SOL PANEL)
  ================================= */
  useEffect(() => {
    const token = localStorage.getItem("token");

    const fetchChats = async () => {
      try {
        // Backend'in artık hem aktif hem 'closed' olanları döndürmeli
        const res = await fetch("http://localhost:5050/api/chats/admin", {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json();

        setActiveChats(
          (data || []).map((c) => ({
            id: c.customerId,
            name: c.customerName,
            chatId: c.chatId,
            lastText: c.lastText,
            status: c.status || 'active', // ✅ EKLENDİ: Durum bilgisini alıyoruz
            updatedAt: c.updatedAt // ✅ EKLENDİ: Sıralama için tarih (opsiyonel)
          }))
        );
      } catch (err) {
        console.error("Chat list fetch error:", err);
      }
    };

    fetchChats();
  }, []);

  // ... (2. useEffect ve diğer kısımlar aynı kalabilir) ...
  useEffect(() => {
    if (!selectedChat?.id) return;
    const token = localStorage.getItem("token");
    const fetchDetails = async () => {
      try {
        setLoadingDetails(true);
        const [userRes, ordersRes] = await Promise.all([
          fetch(`http://localhost:5050/api/chats/user-details/${selectedChat.id}`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`http://localhost:5050/api/orders/by-user/${selectedChat.id}`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        const userData = await userRes.json();
        const ordersData = await ordersRes.json();
        setCustomerDetails({ user: userData.user, orders: ordersData || [] });
      } catch (err) {
        console.error("Customer details error:", err);
        setCustomerDetails(null);
      } finally {
        setLoadingDetails(false);
      }
    };
    fetchDetails();
  }, [selectedChat]);


  return (
    <div style={styles.container}>
      {/* SOL PANEL */}
      <div style={styles.leftPanel}>
        <h3 style={styles.panelTitle}>Conversations</h3>

        {activeChats.map((c) => {
          // ✅ EKLENDİ: Sohbet kapalıysa stil değiştirme mantığı
          const isClosed = c.status === 'closed';
          const isSelected = selectedChat?.chatId === c.chatId;

          return (
            <div
              key={c.chatId}
              style={{
                ...styles.customerItem,
                // Seçiliyse mavi, kapalıysa gri, normalse şeffaf
                background: isSelected 
                  ? "#eef6ff" 
                  : (isClosed ? "#f9f9f9" : "transparent"),
                border: isSelected ? "1px solid #007bff" : "1px solid transparent",
                opacity: isClosed && !isSelected ? 0.6 : 1, // Kapalılar biraz soluk dursun
              }}
              onClick={() => setSelectedChat(c)}
            >
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div style={{ fontWeight: "bold" }}>{c.name}</div>
                
                {/* Durum Rozeti (Active/Closed) */}
                <span style={{
                    fontSize: 10, 
                    padding: "2px 6px", 
                    borderRadius: 4, 
                    background: isClosed ? "#ddd" : "#28a745",
                    color: isClosed ? "#555" : "#fff"
                }}>
                  {isClosed ? "Ended" : "Active"}
                </span>
              </div>

              <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                {c.lastText ? c.lastText.substring(0, 30) + "..." : "No messages"}
              </div>
            </div>
          );
        })}
      </div>

      {/* ORTA PANEL */}
      <div style={styles.middlePanel}>
        {selectedChat ? (
          <>
            {/* Eğer sohbet kapalıysa üstte bir uyarı gösterelim */}
            {selectedChat.status === 'closed' && (
               <div style={{ padding: 10, background: '#fff3cd', color: '#856404', marginBottom: 10, borderRadius: 5, fontSize: 13, textAlign:'center' }}>
                 ⚠️ This chat has been ended by the customer.
               </div>
            )}
            
            <SupportChat
              supportUser={user}
              chatId={selectedChat.chatId}
              customerName={selectedChat.name}
              // Chat kapalıysa Admin'in yazmasını engellemek istersen prop olarak geçebilirsin:
              isChatClosed={selectedChat.status === 'closed'} 
            />
          </>
        ) : (
          <div style={styles.emptyState}>
            Select a chat to see conversation history.
          </div>
        )}
      </div>

      {/* SAĞ PANEL (Aynı kalıyor) */}
      <div style={styles.rightPanel}>
         {/* ... (Buradaki kodların aynısı) ... */}
         {loadingDetails ? (
          <div style={styles.emptyState}>Loading user info...</div>
        ) : customerDetails ? (
          <div>
            <h4 style={styles.sectionTitle}>Customer Profile</h4>
            <div style={styles.profileBox}>
              <p><strong>Name:</strong> {customerDetails.user?.name}</p>
              <p><strong>Phone:</strong> {customerDetails.user?.phone || "N/A"}</p>
              <p><strong>Address:</strong> {customerDetails.user?.address || "N/A"}</p>
            </div>
            <hr style={styles.divider} />
            <h4 style={styles.sectionTitle}>Order History</h4>
            {customerDetails.orders.length > 0 ? (
              customerDetails.orders.map((o) => (
                <div key={o._id} style={styles.orderCard}>
                  <div style={styles.orderHeader}>
                    <span style={styles.orderId}>#{o.orderCode}</span>
                    <span style={{ ...styles.statusTag, backgroundColor: o.status === "Delivered" ? "#dcf8c6" : "#fff3cd" }}>{o.status}</span>
                  </div>
                   <div style={styles.orderFooter}><strong>Total: {o.totalPrice} TL</strong></div>
                </div>
              ))
            ) : <p style={styles.noOrder}>No orders found.</p>}
          </div>
        ) : <div style={styles.emptyState}>User details will appear here.</div>}
      </div>
    </div>
  );
}

// ... styles objesi aynı kalabilir ...
const styles = {
  // ... senin mevcut stil kodların ...
  container: {
    display: "flex",
    height: "calc(100vh - 80px)",
    marginTop: 80,
    backgroundColor: "#f0f2f5",
  },
  leftPanel: {
    width: 300,
    borderRight: "1px solid #ddd",
    padding: 15,
    backgroundColor: "#fff",
    overflowY: "auto",
  },
  middlePanel: {
    flex: 2,
    padding: 15,
    display: "flex",
    flexDirection: "column",
  },
  rightPanel: {
    width: 350,
    padding: 20,
    borderLeft: "1px solid #ddd",
    backgroundColor: "#fff",
    overflowY: "auto",
  },
  panelTitle: { fontSize: 18, marginBottom: 20, fontWeight: 600 },
  sectionTitle: { fontSize: 16, fontWeight: "bold", marginBottom: 12 },
  customerItem: {
    padding: 15,
    cursor: "pointer",
    borderRadius: 10,
    marginBottom: 10,
  },
  profileBox: { fontSize: 14, lineHeight: 1.8 },
  divider: { margin: "20px 0", borderTop: "1px solid #eee" },
  orderCard: {
    padding: 12,
    background: "#f8f9fa",
    borderRadius: 10,
    marginBottom: 15,
    border: "1px solid #eee",
  },
  orderHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  orderId: { fontSize: 13, fontWeight: "bold", color: "#007bff" },
  statusTag: {
    fontSize: 10,
    padding: "3px 8px",
    borderRadius: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  productList: { display: "flex", flexDirection: "column", gap: 10 },
  productItem: { display: "flex", gap: 12, alignItems: "center" },
  productImg: {
    width: 45,
    height: 45,
    borderRadius: 8,
    objectFit: "cover",
    border: "1px solid #ddd",
  },
  productInfo: { display: "flex", flexDirection: "column" },
  productName: { fontSize: 13, fontWeight: 500 },
  productQty: { fontSize: 11, color: "#666" },
  orderFooter: {
    textAlign: "right",
    marginTop: 12,
    paddingTop: 10,
    borderTop: "1px dashed #ccc",
  },
  emptyState: {
    padding: 40,
    textAlign: "center",
    color: "#aaa",
  },
  noOrder: {
    textAlign: "center",
    color: "#999",
    fontSize: 13,
    marginTop: 20,
  },
};

export default AdminLiveChatPage;