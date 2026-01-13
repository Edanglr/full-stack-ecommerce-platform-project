import React, { useEffect, useState, useCallback } from "react";
import SupportChat from "./chat/SupportChat";
import { useChatSocket } from "../hooks/useChatSocket";


function AdminLiveChatPage({ user, setHasNewSupportMessage }) {
  const [activeChats, setActiveChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [customerDetails, setCustomerDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loadingChats, setLoadingChats] = useState(true);
  const [error, setError] = useState(null);
  const [processingOrder, setProcessingOrder] = useState(null);

  

  /* ================================
     1️⃣ Anlık Mesaj Dinleme (Socket.io)
  ================================= */
  const handleAdminNewMessage = useCallback((msg) => {

    if (!window.location.pathname.includes("/admin/chats")) {
      setHasNewSupportMessage(true);
    }

    console.log("📩 Admin received new message:", msg);

    setActiveChats((prev) => {
      const existingChat = prev.find((c) => c.chatId === msg.chatId);

      if (existingChat) {
        const updatedChat = {
          ...existingChat,
          lastText: msg.text,
          status: 'active',
          updatedAt: new Date().toISOString()
        };
        return [updatedChat, ...prev.filter((c) => c.chatId !== msg.chatId)];
      } else {
        const newChat = {
          id: msg.senderRole === "customer" ? msg.senderId : msg.chatId.replace("chat-", ""),
          name: msg.senderName || "New Customer",
          chatId: msg.chatId,
          lastText: msg.text,
          status: 'active',
          updatedAt: new Date().toISOString()
        };
        return [newChat, ...prev];
      }
    });
  }, []);

  useChatSocket({
    onAdminMessage: handleAdminNewMessage
  });

  /* ================================
     2️⃣ Chat Listesi (İlk Yükleme)
  ================================= */
  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      setError("No authentication token found");
      setLoadingChats(false);
      return;
    }
    
    const fetchChats = async () => {
      try {
        setLoadingChats(true);
        setError(null);

        console.log("🔄 Fetching admin chat list...");

        const res = await fetch("http://localhost:5050/api/chats/admin", {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();
        console.log("📊 Received chat data:", data);

        if (!Array.isArray(data)) {
          throw new Error("Invalid response format - expected array");
        }

        const formattedChats = data.map((c) => ({
          id: c.customerId,
          name: c.customerName,
          chatId: c.chatId,
          lastText: c.lastText || "No messages",
          status: c.status || 'active',
          updatedAt: c.updatedAt || c.lastMessageAt,
          messageCount: c.messageCount || 0,
          isClaimed: !!c.claimedBy,  
          claimedBy: c.claimedBy || null
        }));

        console.log(`✅ Loaded ${formattedChats.length} chats`);
        setActiveChats(formattedChats);

      } catch (err) {
        console.error("❌ Chat list fetch error:", err);
        setError(err.message);
        setActiveChats([]);
      } finally {
        setLoadingChats(false);
      }
    };
    setHasNewSupportMessage(false);
    fetchChats();
  }, []);
  const handleChatDeleted = useCallback((deletedChatId) => {
    setActiveChats((prev) => prev.filter((c) => c.chatId !== deletedChatId));
    
    
    setSelectedChat(null);
    setCustomerDetails(null);
  }, []);

  const claimChat = async (chatId) => {
  const token = localStorage.getItem("token");

  try {
    const res = await fetch(
      `http://localhost:5050/api/chats/admin/claim/${chatId}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!res.ok) {
      const data = await res.json();
      alert(data.message || "Chat already claimed");
      return;
    }

    // UI güncelle
    setActiveChats((prev) =>
      prev.map((c) =>
        c.chatId === chatId
          ? { ...c, isClaimed: true, claimedBy: user._id }
          : c
      )
    );
  } catch (err) {
    console.error("❌ Claim error:", err);
    alert("Error claiming chat");
  }
};

  useEffect(() => {
    if (!selectedChat?.id) return;

    const token = localStorage.getItem("token");

    const fetchDetails = async () => {
      try {
        setLoadingDetails(true);
        console.log("🔍 Fetching customer details for:", selectedChat.id);

        const [userRes, ordersRes] = await Promise.all([
          fetch(`http://localhost:5050/api/chats/user-details/${selectedChat.id}`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch(`http://localhost:5050/api/orders/by-user/${selectedChat.id}`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
        ]);

        const userData = await userRes.json();
        const ordersData = await ordersRes.json();

        console.log("✅ Customer details loaded:", userData.user?.name);
        setCustomerDetails({
          user: userData.user,
          orders: ordersData || [],
          favorites: userData.favorites || [] // Favorites (Wishlist) eklendi
        });

      } catch (err) {
        console.error("❌ Customer details error:", err);
        setCustomerDetails(null);
      } finally {
        setLoadingDetails(false);
      }
    };

    fetchDetails();
  }, [selectedChat]);

  /* ================================
     4️⃣ Sipariş İptal/İade İşlemleri
  ================================= */
  const handleCancelOrder = async (orderId) => {
    if (!window.confirm("Are you sure you want to cancel this order?")) return;

    const token = localStorage.getItem("token");
    setProcessingOrder(orderId);

    try {
      const res = await fetch(`http://localhost:5050/api/orders/${orderId}/cancel`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (res.ok) {
        alert("Order cancelled successfully!");
        // Siparişleri yeniden yükle
        const ordersRes = await fetch(`http://localhost:5050/api/orders/by-user/${selectedChat.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const ordersData = await ordersRes.json();
        setCustomerDetails(prev => ({ ...prev, orders: ordersData }));
      } else {
        const data = await res.json();
        alert(data.message || "Failed to cancel order");
      }
    } catch (err) {
      console.error("❌ Cancel order error:", err);
      alert("Error cancelling order");
    } finally {
      setProcessingOrder(null);
    }
  };

  const handleInitiateReturn = async (orderId) => {
    if (!window.confirm("Initiate return for this order?")) return;

    const token = localStorage.getItem("token");
    setProcessingOrder(orderId);

    try {
      const res = await fetch(`http://localhost:5050/api/returns`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          orderId: orderId,
          reason: "Customer requested via live support"
        })
      });

      if (res.ok) {
        alert("Return initiated successfully!");
        // Siparişleri yeniden yükle
        const ordersRes = await fetch(`http://localhost:5050/api/orders/by-user/${selectedChat.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const ordersData = await ordersRes.json();
        setCustomerDetails(prev => ({ ...prev, orders: ordersData }));
      } else {
        const data = await res.json();
        alert(data.message || "Failed to initiate return");
      }
    } catch (err) {
      console.error("❌ Return error:", err);
      alert("Error initiating return");
    } finally {
      setProcessingOrder(null);
    }
  };

  if (!user) {
    return (
      <div style={{ marginTop: 100, textAlign: 'center' }}>
        Loading Admin Panel...
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* SOL PANEL */}
      <div style={styles.leftPanel}>
        <h3 style={styles.panelTitle}>Conversations</h3>

        {loadingChats ? (
          <div style={styles.loadingState}>
            <div style={styles.spinner}></div>
            <p>Loading chats...</p>
          </div>
        ) : error ? (
          <div style={styles.errorState}>
            <p style={{ color: '#d9534f', fontSize: 14 }}>⚠️ {error}</p>
            <button
              onClick={() => window.location.reload()}
              style={styles.retryButton}
            >
              Retry
            </button>
          </div>
        ) : activeChats.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={{ fontSize: 14, color: '#999' }}>No active conversations yet.</p>
            <p style={{ fontSize: 12, color: '#bbb', marginTop: 10 }}>
              Chats will appear here when customers send messages.
            </p>
          </div>
        ) : (
          /* ================================
            SOL PANEL - Chat Listesi Kısmı
          ================================= */
          activeChats.map((c) => {
            const isSelected = selectedChat?.chatId === c.chatId;
            return (
              <div
                key={c.chatId}
                onClick={() => setSelectedChat(c)}
                style={{
                  ...styles.customerItem,
                  backgroundColor: isSelected ? "#eef5ff" : "#fff",
                  borderLeft: isSelected ? "4px solid #007bff" : "4px solid transparent"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: "#777", marginTop: 4 }}>
                      {c.lastText?.length > 35 ? c.lastText.slice(0, 35) + "…" : c.lastText}
                    </div>
                  </div>

                  {isSelected && (
                    <button
                      title="Clear chat"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleChatDeleted(c.chatId);
                      }}
                      style={styles.deleteIconBtn}
                    >
                      delete
                    </button>
                  )}
                </div>
                {/* CLAIM BUTTON / STATUS */}
                {!c.isClaimed ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      claimChat(c.chatId);
                    }}
                    style={{
                      marginTop: 6,
                      padding: "4px 10px",
                      fontSize: 11,
                      background: "#007bff",
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer"
                    }}
                  >
                    Claim
                  </button>
                ) : (
                  <span
                    style={{
                      marginTop: 6,
                      fontSize: 11,
                      color: "#28a745",
                      fontWeight: "bold"
                    }}
                  >
                    ✔ Claimed
                  </span>
                )}

              </div>

            );

          })
        )}

      </div>

      {/* ORTA PANEL */}
      <div style={styles.middlePanel}>
        {selectedChat ? (
          <>
            {selectedChat.status === 'closed' && (
              <div style={{
                padding: 10,
                background: '#fff3cd',
                color: '#856404',
                marginBottom: 10,
                borderRadius: 5,
                fontSize: 13,
                textAlign: 'center',
                border: '1px solid #ffeeba'
              }}>
                ⚠️ This chat has been ended by the customer. History is preserved.
              </div>
            )}
            <SupportChat
              supportUser={user}
              chatId={selectedChat.chatId}
              customerName={selectedChat.name}
              onChatDeleted={handleChatDeleted}
              
            />
          </>
        ) : (
          <div style={styles.centerEmptyState}>
            <div style={{ fontSize: 48, marginBottom: 20 }}>💬</div>
            <p style={{ fontSize: 16, color: '#666' }}>Select a chat to see conversation history</p>
          </div>
        )}
      </div>

      {/* SAĞ PANEL */}
      <div style={styles.rightPanel}>
        {loadingDetails ? (
          <div style={styles.centerEmptyState}>
            <div style={styles.spinner}></div>
            <p>Loading user info...</p>
          </div>
        ) : customerDetails ? (
          <div>
            <h4 style={styles.sectionTitle}>Customer Profile</h4>
            <div style={styles.profileBox}>
              <p><strong>Name:</strong> {customerDetails.user?.name}</p>
              <p><strong>Email:</strong> {customerDetails.user?.email || "N/A"}</p>
              <p><strong>Phone:</strong> {customerDetails.user?.phone || "N/A"}</p>
              <p><strong>Address:</strong> {customerDetails.user?.address || "N/A"}</p>
            </div>
            {/* WISHLIST SECTION */}
            <hr style={styles.divider} />

            <h4 style={styles.sectionTitle}>Wishlist ({customerDetails.favorites?.length || 0})</h4>
            {customerDetails.favorites && customerDetails.favorites.length > 0 ? (
              <div style={styles.wishlistGrid}>
                {customerDetails.favorites.map((fav) => {
                  const product = fav.product;
                  if (!product) return null;

                  return (
                    <div key={fav._id} style={styles.wishlistItem}>
                      <img
                        src={product.imageUrl || "https://via.placeholder.com/50"}
                        alt={product.name}
                        style={styles.wishlistImage}
                      />
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={styles.wishlistName} title={product.name}>
                          {product.name}
                        </div>
                        <div style={styles.wishlistPrice}>
                          {product.price} TL
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: '#999' }}>No items in wishlist.</p>
            )}

            <hr style={styles.divider} />

            <h4 style={styles.sectionTitle}>Order History</h4>
            {customerDetails.orders.length > 0 ? (
              customerDetails.orders.map((o) => {
                const canCancel = o.status === 'Processing';
                const canReturn = o.status === 'Delivered';
                const isProcessing = processingOrder === o._id;

                return (
                  <div key={o._id} style={styles.orderCard}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontWeight: 'bold', fontSize: 14 }}>#{o.orderCode}</span>
                      <span style={{
                        fontSize: 12,
                        background: o.status === 'Cancelled' ? '#ffdada' :
                          o.status === 'Delivered' ? '#d4edda' :
                            o.status === 'Processing' ? '#fff3cd' : '#dcf8c6',
                        padding: '3px 8px',
                        borderRadius: 4,
                        fontWeight: '600'
                      }}>
                        {o.status}
                      </span>
                    </div>

                    <p style={{ margin: '5px 0', fontSize: 14, color: '#555' }}>
                      <strong>{o.totalPrice} TL</strong>
                    </p>

                    <div style={{ fontSize: 12, color: '#999', marginBottom: 10 }}>
                      {new Date(o.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      {canCancel && (
                        <button
                          onClick={() => handleCancelOrder(o._id)}
                          disabled={isProcessing}
                          style={{
                            flex: 1,
                            padding: '6px 10px',
                            background: isProcessing ? '#ccc' : '#ff4d4d',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 4,
                            fontSize: 12,
                            fontWeight: '600',
                            cursor: isProcessing ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {isProcessing ? 'Processing...' : 'Cancel Order'}
                        </button>
                      )}

                      {canReturn && (
                        <button
                          onClick={() => handleInitiateReturn(o._id)}
                          disabled={isProcessing}
                          style={{
                            flex: 1,
                            padding: '6px 10px',
                            background: isProcessing ? '#ccc' : '#ffc107',
                            color: '#000',
                            border: 'none',
                            borderRadius: 4,
                            fontSize: 12,
                            fontWeight: '600',
                            cursor: isProcessing ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {isProcessing ? 'Processing...' : 'Initiate Return'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <p style={{ fontSize: 13, color: '#999' }}>No orders found.</p>
            )}
          </div>
        ) : (
          <div style={styles.centerEmptyState}>
            <div style={{ fontSize: 36, marginBottom: 15 }}>👤</div>
            <p style={{ fontSize: 14, color: '#999' }}>User details will appear here</p>
          </div>
        )}


      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    height: "calc(100vh - 80px)",
    marginTop: 80,
    backgroundColor: "#f0f2f5"
  },
  leftPanel: {
    width: 300,
    borderRight: "1px solid #ddd",
    padding: 15,
    backgroundColor: "#fff",
    overflowY: "auto"
  },
  middlePanel: {
    flex: 2,
    padding: 15,
    display: "flex",
    flexDirection: "column"
  },
  rightPanel: {
    width: 350,
    padding: 20,
    borderLeft: "1px solid #ddd",
    backgroundColor: "#fff",
    overflowY: "auto"
  },
  panelTitle: {
    fontSize: 18,
    marginBottom: 20,
    fontWeight: 600
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12
  },
  customerItem: {
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    transition: "0.2s"
  },
  profileBox: {
    fontSize: 14,
    lineHeight: 1.8
  },
  divider: {
    margin: "20px 0",
    borderTop: "1px solid #eee"
  },
  orderCard: {
    padding: 14,
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    marginBottom: 12,
    border: "1px solid #eee"
  },
  emptyState: {
    padding: 40,
    textAlign: "center",
    color: "#aaa"
  },
  centerEmptyState: {
    padding: 40,
    textAlign: "center",
    color: "#aaa",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    height: "100%"
  },
  loadingState: {
    padding: 40,
    textAlign: "center",
    color: "#666"
  },
  errorState: {
    padding: 40,
    textAlign: "center"
  },
  spinner: {
    border: "3px solid #f3f3f3",
    borderTop: "3px solid #007bff",
    borderRadius: "50%",
    width: "40px",
    height: "40px",
    animation: "spin 1s linear infinite",
    margin: "0 auto 15px"
  },
  retryButton: {
    marginTop: 15,
    padding: "8px 20px",
    background: "#007bff",
    color: "#fff",
    border: "none",
    borderRadius: 5,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: "bold"
  },
  wishlistGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
    gap: 10
  },
  wishlistItem: {
    border: "1px solid #eee",
    borderRadius: 8,
    padding: 8,
    display: "flex",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#f8f9fa"
  },
  wishlistImage: {
    width: 40,
    height: 40,
    objectFit: "cover",
    borderRadius: 4,
    backgroundColor: "#fff"
  },
  wishlistName: {
    fontSize: 12,
    fontWeight: "600",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    marginBottom: 2
  },
wishlistPrice: {
  fontSize: 11,
  color: "#28a745",
  fontWeight: "bold"
},

customerItem: {
  padding: "12px 14px",
  borderRadius: 10000,
  marginBottom: 8,
  cursor: "pointer",
  transition: "all 0.2s ease",
  backgroundColor: "#fff"
},

deleteIconBtn: {
  background: "#de7d7d",
  border: "none",
  borderRadius: 10000,
  fontSize: 10,
  cursor: "pointer",
  opacity: 1,
  transition: "0.2s"
},

};

export default AdminLiveChatPage;
