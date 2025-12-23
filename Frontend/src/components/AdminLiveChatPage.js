import React, { useEffect, useState } from "react";
import SupportChat from "./chat/SupportChat";

function AdminLiveChatPage({ user }) {
  const [activeChats, setActiveChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [customerDetails, setCustomerDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

 // frontend/src/components/AdminLiveChatPage.js içindeki useEffect kısmı

useEffect(() => {
  const fetchUserDetails = async () => {
    // selectedChat.id'nin (customerId) varlığından emin oluyoruz
    if (!selectedChat?.id) return; 

    try {
      setCustomerDetails(null); // Yeni yükleme için temizle
      const token = localStorage.getItem("token");
      
      // Port ve URL'nin backend ile birebir aynı olduğundan emin olun
      const res = await fetch(`http://localhost:5050/api/chats/user-details/${selectedChat.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Veri çekilemedi");

      const data = await res.json();
      // Gelen veriyi state'e atıyoruz
      setCustomerDetails(data); 
    } catch (err) {
      console.error("Detay çekme hatası:", err);
      // Hata olsa bile "Loading" yazısından kurtulmak için boş obje set edebiliriz
      setCustomerDetails({ user: { name: "Hata oluştu" }, orders: [] });
    }
  };

  fetchUserDetails();
}, [selectedChat]);

  // 2) Aktif Sohbet Listesini Çek
  useEffect(() => {
    const token = localStorage.getItem("token");
    const fetchChats = async () => {
      try {
        const res = await fetch("http://localhost:5050/api/chats/admin", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setActiveChats((data || []).map(c => ({
          id: c.customerId,
          name: c.customerName,
          chatId: c.chatId,
          lastText: c.lastText,
        })));
      } catch (err) { console.error("Chat listesi çekilemedi:", err); }
    };
    fetchChats();
  }, []);

  return (
    <div style={styles.container}>
      {/* SOL PANEL: Sohbet Listesi */}
      <div style={styles.leftPanel}>
        <h3 style={styles.panelTitle}>Customer Chats</h3>
        {activeChats.map((c) => (
          <div
            key={c.chatId}
            style={{
              ...styles.customerItem,
              background: selectedChat?.chatId === c.chatId ? "#eef6ff" : "transparent",
              border: selectedChat?.chatId === c.chatId ? "1px solid #007bff" : "1px solid transparent",
            }}
            onClick={() => setSelectedChat(c)}
          >
            <div style={{ fontWeight: "bold" }}>{c.name}</div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>{c.lastText}</div>
          </div>
        ))}
      </div>

      {/* ORTA PANEL: Canlı Destek Ekranı */}
      <div style={styles.middlePanel}>
        {selectedChat ? (
          <SupportChat
            supportUser={user}
            chatId={selectedChat.chatId}
            customerName={selectedChat.name}
          />
        ) : (
          <div style={styles.emptyState}>Select a chat to see conversation history.</div>
        )}
      </div>

      {/* SAĞ PANEL: Kullanıcı Detayları ve Siparişler */}
      <div style={styles.rightPanel}>
        {loadingDetails ? (
          <div style={styles.emptyState}>Loading user info...</div>
        ) : customerDetails ? (
          <div style={styles.details}>
            <h4 style={styles.sectionTitle}>Customer Profile</h4>
            <div style={styles.profileBox}>
              <p><strong>Name:</strong> {customerDetails.user?.name}</p>
              <p><strong>Phone:</strong> {customerDetails.user?.phone || "Not provided"}</p>
              <p><strong>Address:</strong> {customerDetails.user?.address || "No address saved"}</p>
            </div>
            
            <hr style={styles.divider} />
            
            <h4 style={styles.sectionTitle}>Order History</h4>
            {customerDetails.orders && customerDetails.orders.length > 0 ? (
              customerDetails.orders.map((o) => (
                <div key={o._id} style={styles.orderCard}>
                  <div style={styles.orderHeader}>
                    <span style={styles.orderId}>#{o._id.slice(-6).toUpperCase()}</span>
                    <span style={{ 
                      ...styles.statusTag, 
                      backgroundColor: o.isDelivered ? "#d4edda" : "#fff3cd",
                      color: o.isDelivered ? "#155724" : "#856404"
                    }}>
                      {o.isDelivered ? "Delivered" : (o.status || "Paid")}
                    </span>
                  </div>
                  
                  {/* Ürün Listesi */}
                  <div style={styles.productList}>
                    {o.orderItems?.map((item, i) => (
                      <div key={i} style={styles.productItem}>
                        <img 
                          src={item.product?.image || "https://via.placeholder.com/40"} 
                          alt="product" 
                          style={styles.productImg} 
                        />
                        <div style={styles.productInfo}>
                          <div style={styles.productName}>{item.product?.name || "Product"}</div>
                          <div style={styles.productQty}>Quantity: {item.qty}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={styles.orderFooter}>
                    <strong>Total: {o.totalPrice || o.total || 0} TL</strong>
                  </div>
                </div>
              ))
            ) : (
              <p style={styles.noOrder}>No previous orders found.</p>
            )}
          </div>
        ) : (
          <div style={styles.emptyState}>User details will appear here.</div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { display: "flex", height: "calc(100vh - 80px)", marginTop: 80, backgroundColor: "#f0f2f5" },
  leftPanel: { width: 300, borderRight: "1px solid #ddd", padding: 15, overflowY: "auto", backgroundColor: "#fff" },
  middlePanel: { flex: 2, padding: 15, display: "flex", flexDirection: "column" },
  rightPanel: { width: 350, padding: 20, borderLeft: "1px solid #ddd", backgroundColor: "#fff", overflowY: "auto" },
  panelTitle: { fontSize: 18, marginBottom: 20, fontWeight: "600" },
  sectionTitle: { fontSize: 16, fontWeight: "bold", marginBottom: 12, color: "#333" },
  customerItem: { padding: "15px", cursor: "pointer", borderRadius: 10, marginBottom: 10, transition: "0.2s" },
  profileBox: { fontSize: 14, lineHeight: "1.8", color: "#444" },
  divider: { margin: "25px 0", border: "0", borderTop: "1px solid #eee" },
  orderCard: { padding: "12px", background: "#f8f9fa", border: "1px solid #eee", borderRadius: 10, marginBottom: 15 },
  orderHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  orderId: { fontSize: 13, fontWeight: "bold", color: "#007bff" },
  statusTag: { fontSize: 10, padding: "3px 8px", borderRadius: 12, fontWeight: "bold", textTransform: "uppercase" },
  productList: { display: "flex", flexDirection: "column", gap: 10 },
  productItem: { display: "flex", alignItems: "center", gap: 12 },
  productImg: { width: 45, height: 45, borderRadius: 8, objectFit: "cover", border: "1px solid #e0e0e0" },
  productInfo: { display: "flex", flexDirection: "column" },
  productName: { fontSize: 13, fontWeight: "500" },
  productQty: { fontSize: 11, color: "#666" },
  orderFooter: { textAlign: "right", marginTop: 12, paddingTop: 10, borderTop: "1px dashed #ccc", fontSize: 14 },
  emptyState: { padding: 50, textAlign: "center", color: "#aaa", fontSize: 15 },
  noOrder: { textAlign: "center", color: "#999", fontSize: 13, marginTop: 20 }
};

export default AdminLiveChatPage;