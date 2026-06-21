import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import axios from '../axiosConfig';
import { io } from 'socket.io-client';
import toast, { Toaster } from 'react-hot-toast';
import EmojiPicker from 'emoji-picker-react';
import AvatarEditor from 'react-avatar-editor';
import CryptoJS from 'crypto-js';

const SECRET_KEY = "DluaChat_Sieu_Bao_Mat_2026";
const socket = io('https://dlua-chat-api.onrender.com');

// ==========================================
// CÁC HÀM TIỆN ÍCH (UTILS)
// ==========================================
const encryptText = (text) => {
    if (!text) return "";
    try { return CryptoJS.AES.encrypt(text, SECRET_KEY).toString(); } 
    catch (error) { return text; }
};

const decryptText = (ciphertext) => {
    if (!ciphertext) return "";
    try {
        if (!ciphertext.startsWith("U2FsdGVk")) return ciphertext;
        const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
        const decoded = bytes.toString(CryptoJS.enc.Utf8);
        return decoded || ciphertext;
    } catch (error) { return ciphertext; }
};

const formatMessageTime = (dateString) => new Date(dateString).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
const shouldShowTime = (currMsg, prevMsg) => {
    if (!prevMsg) return true;
    const currDate = new Date(currMsg.createdAt), prevDate = new Date(prevMsg.createdAt);
    if (currDate.getDate() !== prevDate.getDate() || currDate.getMonth() !== prevDate.getMonth() || currDate.getFullYear() !== prevDate.getFullYear()) return true;
    return (currDate - prevDate) > 5 * 60 * 1000;
};
const formatReadTime = (date) => {
    if (!date) return '';
    const diff = Math.floor((new Date() - new Date(date)) / 60000);
    if (diff > 1440) return `Đã xem ${Math.floor(diff / 1440)} ngày trước`;
    if (diff > 60) return `Đã xem ${Math.floor(diff / 60)} giờ trước`;
    if (diff > 0) return `Đã xem ${diff} phút trước`;
    return 'Đã xem vừa xong';
};
const formatLastSeen = (date) => {
    if (!date) return 'Chưa rõ';
    const diff = Math.floor((new Date() - new Date(date)) / 60000);
    if (diff > 1440) return `Hoạt động ${Math.floor(diff / 1440)} ngày trước`;
    if (diff > 60) return `Hoạt động ${Math.floor(diff / 60)} giờ trước`;
    if (diff > 0) return `Hoạt động ${diff} phút trước`;
    return 'Vừa mới truy cập';
};
const formatCallDuration = (s) => (Math.floor(s / 60) > 0 ? `${Math.floor(s / 60)} phút ` : '') + `${s % 60} giây`;
const getSenderId = (sender) => typeof sender === 'object' && sender !== null ? sender._id : sender;

const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); }
    return outputArray;
};

// ==========================================
// COMPONENT CHÍNH
// ==========================================
export default function Home() {
    const navigate = useNavigate();

    // 1. STATES: UI & User
    const [user, setUser] = useState(null);
    const [activeTab, setActiveTab] = useState('chat');
    const [isDarkMode, setIsDarkMode] = useState(() => {
        const savedTheme = localStorage.getItem('dlua_theme');
        return savedTheme === 'dark';
    });
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isInstallable, setIsInstallable] = useState(false);

    // 2. STATES: Dữ liệu (Data)
    const [friends, setFriends] = useState([]);
    const [groups, setGroups] = useState([]);
    const [pendingRequests, setPendingRequests] = useState([]);
    const [searchResult, setSearchResult] = useState(null);
    const [localChatSearch, setLocalChatSearch] = useState('');
    const [globalSearchQuery, setGlobalSearchQuery] = useState('');
    const [currentChat, setCurrentChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    
    // ĐÃ SỬA: Không dùng localStorage nữa, khởi tạo mảng rỗng để lấy từ DB
    const [unreadCounts, setUnreadCounts] = useState({});

    // 3. STATES: Chat & Menu Tools
    const [replyingTo, setReplyingTo] = useState(null);
    const [activeMenuId, setActiveMenuId] = useState(null); 
    const [showEmoji, setShowEmoji] = useState(false);
    const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [typingUsers, setTypingUsers] = useState({});

    // 4. STATES: WebRTC & Call
    const [callStatus, setCallStatus] = useState('idle'); 
    const [isFrontCamera, setIsFrontCamera] = useState(true);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [callData, setCallData] = useState(null); 
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [callStartTime, setCallStartTime] = useState(null);

    // 5. STATES: Profile & Group creation
    const [newGroupName, setNewGroupName] = useState('');
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [avatarFile, setAvatarFile] = useState(null);
    const [avatarScale, setAvatarScale] = useState(1.2);
    const [passwords, setPasswords] = useState({ oldPass: '', newPass: '' });

    // 6. REFS
    const chatContainerRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const editorRef = useRef(null);
    const uploadAvatarInputRef = useRef(null);
    const scrollRef = useRef();
    const imageInputRef = useRef(null);
    const fileInputRef = useRef(null);
    const videoInputRef = useRef(null);
    const myVideoRef = useRef();
    const remoteVideoRef = useRef();
    const peerRef = useRef();
    const ringtoneRef = useRef(null);
    const pendingCandidates = useRef([]);
    const streamRef = useRef(null);

    const currentChatRef = useRef(currentChat);
    useEffect(() => { currentChatRef.current = currentChat; }, [currentChat]);

    // ==========================================
    // EFFECTS
    // ==========================================

    useEffect(() => {
        const loggedInUser = localStorage.getItem('user') || sessionStorage.getItem('user');
        
        if (!loggedInUser) navigate('/login');
        else {
            const parsedUser = JSON.parse(loggedInUser);
            setUser(parsedUser);
            socket.emit('join_server', parsedUser.id);
            fetchInitialData(parsedUser.id);
        }

        const handleBeforeUnload = () => socket.disconnect();
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [navigate]);

    useEffect(() => {
        const setupPushNotifications = async () => {
            if ('serviceWorker' in navigator && 'PushManager' in window && user) {
                try {
                    const permission = await Notification.requestPermission();
                    if (permission === 'granted') {
                        const registration = await navigator.serviceWorker.ready;
                        const publicVapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY; 
                        
                        if (!publicVapidKey) {
                            console.warn("Chưa đọc được VITE_VAPID_PUBLIC_KEY");
                            return; 
                        }
                        const subscription = await registration.pushManager.subscribe({
                            userVisibleOnly: true,
                            applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
                        });
                        await axios.post('https://dlua-chat-api.onrender.com/api/notifications/subscribe', {
                            userId: user.id, subscription: subscription
                        });
                    }
                } catch (error) { console.error("Lỗi đăng ký Push:", error); }
            }
        };
        setupPushNotifications();
    }, [user]);

    // ĐÃ XÓA useEffect LƯU localStorage CHO UNREAD COUNTS ĐỂ TRÁNH LỖI

    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('dlua_theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('dlua_theme', 'light');
        }
    }, [isDarkMode]);

    useEffect(() => {
        const handleBeforeInstallPrompt = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setIsInstallable(true);
        };
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', () => {
            setIsInstallable(false);
            setDeferredPrompt(null);
        });
        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }, []);

    useEffect(() => {
        if (callStatus === 'ringing' || callStatus === 'calling') {
            if (!ringtoneRef.current) {
                ringtoneRef.current = new Audio('/ringtone.mp3');
                ringtoneRef.current.loop = true;
            }
            ringtoneRef.current.play().catch(() => {});
        } else {
            if (ringtoneRef.current) {
                ringtoneRef.current.pause();
                ringtoneRef.current.removeAttribute('src');
                ringtoneRef.current.load();
                ringtoneRef.current = null;
            }
        }
        if (callStatus === 'active' && !callStartTime) setCallStartTime(Date.now());
    }, [callStatus, callStartTime]);

    useEffect(() => {
        if (!user) return;

        const handleReceiveMessage = (data) => {
            if (data.text && data.type === 'text') data.text = decryptText(data.text);
            if (data.replyTo && data.replyTo.text) data.replyTo.text = decryptText(data.replyTo.text);
            const isGroupMsg = data.groupId !== null && data.groupId !== undefined;
            const incomingChatId = isGroupMsg ? String(data.groupId) : String(getSenderId(data.senderId));
            const currentOpenId = currentChatRef.current ? String(currentChatRef.current._id) : null;

            if (currentOpenId === incomingChatId) {
                setMessages((prev) => {
                    if (prev.find(m => String(m._id) === String(data._id))) return prev;
                    return [...prev, data];
                });
                
                // Cập nhật "đã xem" realtime theo chuẩn mới (Kể cả nhóm)
                axios.post('https://dlua-chat-api.onrender.com/api/messages/mark-read', { 
                    chatId: incomingChatId, 
                    userId: user.id, 
                    isGroup: isGroupMsg 
                });
                socket.emit('mark_read', { senderId: incomingChatId, receiverId: user.id, readAt: new Date(), isGroup: isGroupMsg });
                
                setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
            } else {
                setUnreadCounts((prev) => ({ ...prev, [incomingChatId]: (prev[incomingChatId] || 0) + 1 }));
                const senderName = isGroupMsg ? `Nhóm (${data.senderName})` : (data.senderName || 'Bạn bè');
                const content = data.text ? data.text : (data.imageUrl ? '[Hình ảnh]' : '[Tập tin]');
                toast(`${senderName}: ${content}`, {
                    icon: '💬', position: 'top-right',
                    style: { borderRadius: '12px', background: isDarkMode ? '#1e293b' : '#fff', color: isDarkMode ? '#fff' : '#000', border: '1px solid #3b82f6' }
                });
            }
        };

        const handleUnsent = (messageId) => setMessages((prev) => prev.map(m => m._id === messageId ? { ...m, isUnsent: true } : m));
        const handleReacted = (data) => setMessages((prev) => prev.map(m => m._id === data.messageId ? { ...m, reactions: data.reactions } : m));
        
        const handleMessagesRead = (data) => {
            const current = currentChatRef.current;
            // Sửa lại đoạn này để tương thích logic mảng readBy
            if (current && (current._id === data.receiverId || current._id === data.groupId)) {
                setMessages((prev) => prev.map(m => {
                    if (getSenderId(m.senderId) === user.id) {
                        return { ...m, readBy: [...(m.readBy || []), { userId: data.receiverId, readAt: data.readAt }] };
                    }
                    return m;
                }));
            }
        };

        const handleStatusChanged = (data) => {
            const { userId, isOnline, lastSeen } = data;
            if (!userId) return;
            setFriends(prev => prev.map(f => String(f._id) === String(userId) ? { ...f, isOnline, lastSeen } : f));
            setCurrentChat(prev => {
                if (prev && !prev.isGroup && String(prev._id) === String(userId)) return { ...prev, isOnline, lastSeen };
                return prev;
            });
        };

        socket.on('receive_message', handleReceiveMessage); 
        socket.on('message_unsent', handleUnsent); 
        socket.on('message_reacted', handleReacted); 
        socket.on('messages_read', handleMessagesRead);
        socket.on('user_status_changed', handleStatusChanged); 
        socket.on('display_typing', (senderId) => setTypingUsers(prev => ({ ...prev, [senderId]: true }))); 
        socket.on('hide_typing', (senderId) => setTypingUsers(prev => ({ ...prev, [senderId]: false })));
        
        socket.on('new_friend_request', () => {
            if (user) {
                fetchPendingRequests(user.id);
                toast.success('Bạn có lời mời kết bạn mới!', { icon: '🔔' });
            }
        });
        
        socket.on('group_added', () => { if (user) fetchGroups(user.id); });
        socket.on('group_updated', (data) => {
            if (user) fetchGroups(user.id);
            setCurrentChat(prev => {
                if (prev && prev._id === data.groupId) return { ...prev, members: prev.members.filter(m => m._id !== data.leftUserId) };
                return prev;
            });
        });

        socket.on('call_incoming', (data) => { setCallData(data); setCallStatus('ringing'); });
        socket.on('call_accepted', async (answer) => { 
            setCallStatus('active'); 
            if (peerRef.current) {
                await peerRef.current.setRemoteDescription(new RTCSessionDescription(answer)); 
                for (let c of pendingCandidates.current) {
                    try { await peerRef.current.addIceCandidate(new RTCIceCandidate(c)); } catch(e){ console.error(e) }
                }
                pendingCandidates.current = [];
            }
        });
        socket.on('ice_candidate', async (candidate) => { 
            try { 
                if (peerRef.current && peerRef.current.remoteDescription) { 
                    await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate)); 
                } else {
                    pendingCandidates.current.push(candidate);
                }
            } catch (e) { console.error("Lỗi ICE:", e); } 
        });
        socket.on('call_ended', () => endCallLocally());
        socket.on('force_logout', () => {
            toast.error('Tài khoản của bạn vừa đăng nhập ở một nơi khác!', { duration: 5000, icon: '⚠️' });
            localStorage.clear();
            navigate('/login');
        });

        return () => {
            socket.off('receive_message'); socket.off('message_unsent'); socket.off('message_reacted'); socket.off('messages_read');
            socket.off('user_status_changed'); socket.off('display_typing'); socket.off('hide_typing'); socket.off('new_friend_request'); 
            socket.off('friend_request_accepted'); socket.off('group_added'); socket.off('group_updated');
            socket.off('call_incoming'); socket.off('call_accepted'); socket.off('ice_candidate'); socket.off('call_ended'); socket.off('force_logout');
        };
    }, [user, isDarkMode]); 

    useEffect(() => {
        if (myVideoRef.current && localStream) myVideoRef.current.srcObject = localStream;
        if (remoteVideoRef.current && remoteStream) remoteVideoRef.current.srcObject = remoteStream;
    }, [localStream, remoteStream, callStatus]);

    useEffect(() => { 
        if (currentChat) { 
            setPage(1); setHasMore(true); fetchMessages(1); 
        } 
    }, [currentChat]);

    useEffect(() => { 
        if (page > 1) fetchMessages(page); 
    }, [page]);


    // ==========================================
    // API CALLS & HANDLERS
    // ==========================================
    const fetchInitialData = (userId) => { 
        fetchPendingRequests(userId); 
        fetchFriends(userId); 
        fetchGroups(userId); 
        fetchUnreadCounts(userId);
    };

    const fetchUnreadCounts = async (userId) => {
        try {
            const res = await axios.get(`https://dlua-chat-api.onrender.com/api/messages/unread-counts/${userId}`);
            setUnreadCounts(res.data); 
        } catch (err) { console.error("Lỗi đồng bộ chấm đỏ:", err); }
    };
    
    const fetchFriends = async (userId) => { 
        try { const res = await axios.get(`https://dlua-chat-api.onrender.com/api/auth/friends/${userId}`); setFriends(res.data); } 
        catch (err) { console.error(err); } 
    };
    
    const fetchPendingRequests = async (userId) => { 
        try { const res = await axios.get(`https://dlua-chat-api.onrender.com/api/auth/friend-request/pending/${userId}`); setPendingRequests(res.data); } 
        catch (err) { console.error(err); } 
    };
    
    const fetchGroups = async (userId) => { 
        try { 
            const res = await axios.get(`https://dlua-chat-api.onrender.com/api/groups/${userId}`); 
            const formatted = res.data.map(g => ({ ...g, isGroup: true, fullName: g.name })); 
            setGroups(formatted); 
            const groupIds = formatted.map(g => g._id);
            socket.emit('join_groups', groupIds); 
            if (currentChatRef.current && currentChatRef.current.isGroup) socket.emit('join_groups', [currentChatRef.current._id]);
        } catch (err) { console.error(err); } 
    };

    const fetchMessages = async (pageNum = 1) => {
        if (!currentChatRef.current || !user) return;
        if (pageNum > 1) setIsLoadingMore(true);
        try {
            const chat = currentChatRef.current;
            const isGroupFlag = chat.isGroup ? 'true' : 'false';
            const res = await axios.get(`https://dlua-chat-api.onrender.com/api/messages/${user.id}/${chat._id}?page=${pageNum}&limit=20&isGroup=${isGroupFlag}`);
            
            const fetchedMessages = res.data.map(msg => {
                let decryptedText = msg.text;
                if (msg.text && msg.type === 'text') decryptedText = decryptText(msg.text);
                let decryptedReplyTo = msg.replyTo;
                if (msg.replyTo && msg.replyTo.text && msg.replyTo.type === 'text') {
                    decryptedReplyTo = { ...msg.replyTo, text: decryptText(msg.replyTo.text) };
                }
                return { ...msg, text: decryptedText, replyTo: decryptedReplyTo };
            });

            if (pageNum === 1) {
                setMessages(fetchedMessages);
                const hasUnread = fetchedMessages.some(m => {
                    if (getSenderId(m.senderId) === user.id) return false;
                    if (m.readBy) return !m.readBy.some(r => r.userId === user.id);
                    return !m.isRead;
                });
                if (hasUnread) {
                    await axios.post('https://dlua-chat-api.onrender.com/api/messages/mark-read', { 
                        chatId: chat._id, 
                        userId: user.id, 
                        isGroup: chat.isGroup 
                    });
                    
                    setTimeout(() => {
                        if (socket.connected) {
                            socket.emit('mark_read', { 
                                senderId: chat._id, 
                                receiverId: user.id, 
                                readAt: new Date().toISOString(),
                                isGroup: chat.isGroup
                            });
                        }
                    }, 500);
                }
                setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
            } else {
                const container = chatContainerRef.current;
                const scrollHeightBefore = container.scrollHeight;
                setMessages(prev => [...fetchedMessages, ...prev]);
                setTimeout(() => { if (container) container.scrollTop = container.scrollHeight - scrollHeightBefore; }, 0);
            }
            setHasMore(fetchedMessages.length === 20);
        } catch (err) { console.error("Lỗi fetch message", err); }
        setIsLoadingMore(false);
    };

    const handleScroll = (e) => { 
        if (e.target.scrollTop === 0 && hasMore && !isLoadingMore) setPage(prev => prev + 1); 
    };

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt(); 
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') { setIsInstallable(false); }
        setDeferredPrompt(null);
    };

    const handleSendMessage = async (e) => { 
        e.preventDefault(); 
        if (!newMessage.trim()) return; 
        
        const isGroup = currentChat.isGroup;
        const encryptedText = encryptText(newMessage);

        const messageData = { 
            senderId: user.id, 
            receiverId: isGroup ? null : currentChat._id, 
            groupId: isGroup ? currentChat._id : null, 
            text: encryptedText, 
            replyTo: replyingTo ? replyingTo._id : null, 
            type: 'text' 
        }; 
        
        try { 
            const res = await axios.post('https://dlua-chat-api.onrender.com/api/messages/send', messageData); 
            const socketData = { ...res.data, senderName: user.fullName };
            
            if (isGroup) { 
                currentChat.members.forEach(m => {
                    if (m._id !== user.id) {
                        socket.emit('send_message', { ...socketData, receiverId: m._id, groupId: currentChat._id }); 
                    }
                });
            } else { 
                socket.emit('send_message', socketData); 
            }

            let msgToDisplay = { ...res.data, senderName: user.fullName, text: newMessage }; 
            if (msgToDisplay.replyTo && msgToDisplay.replyTo.text) {
                msgToDisplay.replyTo = { ...msgToDisplay.replyTo, text: decryptText(msgToDisplay.replyTo.text) };
            }
            setMessages((prev) => [...prev, msgToDisplay]); 
            
            setNewMessage(''); setReplyingTo(null); setShowEmoji(false); 
            setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100); 
        } catch (err) { toast.error("Lỗi gửi tin"); } 
    };

    const handleFileUpload = async (e, type) => { 
        const file = e.target.files[0]; 
        if (!file) return; 
        
        const formData = new FormData(); 
        formData.append('file', file); 
        
        try { 
            const uploadRes = await axios.post('https://dlua-chat-api.onrender.com/api/messages/upload', formData); 
            const payloadKey = type === 'image' ? 'imageUrl' : type === 'video' ? 'videoUrl' : 'fileUrl'; 
            const isGroup = currentChat.isGroup; 
            
            const messageData = { 
                senderId: user.id, 
                receiverId: isGroup ? null : currentChat._id, 
                groupId: isGroup ? currentChat._id : null, 
                text: '', 
                [payloadKey]: uploadRes.data.url, 
                fileName: type !== 'image' ? uploadRes.data.name : null, 
                replyTo: replyingTo ? replyingTo._id : null, 
                type: 'text' 
            }; 
            
            const msgRes = await axios.post('https://dlua-chat-api.onrender.com/api/messages/send', messageData); 
            const msgToSend = { ...msgRes.data, senderName: user.fullName }; 
            
            setMessages((prev) => [...prev, msgToSend]); 
            
            if (isGroup) { 
                currentChat.members.forEach(m => { 
                    if(m._id !== user.id) socket.emit('send_message', { ...msgToSend, receiverId: m._id, groupId: currentChat._id }); 
                }); 
            } else { 
                socket.emit('send_message', msgToSend); 
            } 
            
            setReplyingTo(null); 
            setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100); 
        } catch (err) { toast.error(`Lỗi gửi file`); } 
        e.target.value = null; 
    };

    const handleUnsend = async (messageId) => { 
        try { 
            await axios.put(`https://dlua-chat-api.onrender.com/api/messages/unsend/${messageId}`); 
            setMessages((prev) => prev.map(m => m._id === messageId ? { ...m, isUnsent: true } : m)); 
            if (currentChat.isGroup) { 
                currentChat.members.forEach(m => { 
                    if(m._id !== user.id) socket.emit('unsend_message', { messageId, receiverId: m._id, groupId: currentChat._id }); 
                }); 
            } else {
                socket.emit('unsend_message', { messageId, receiverId: currentChat._id }); 
            }
            setActiveMenuId(null); 
        } catch (err) { toast.error("Lỗi thu hồi"); } 
    };

    const handleReact = async (messageId, emoji) => { 
        try { 
            const res = await axios.put(`https://dlua-chat-api.onrender.com/api/messages/react/${messageId}`, { userId: user.id, emoji }); 
            setMessages((prev) => prev.map(m => m._id === messageId ? { ...m, reactions: res.data } : m)); 
            if (currentChat.isGroup) { 
                currentChat.members.forEach(m => { 
                    if(m._id !== user.id) socket.emit('react_message', { messageId, reactions: res.data, receiverId: m._id, groupId: currentChat._id }); 
                }); 
            } else {
                socket.emit('react_message', { messageId, reactions: res.data, receiverId: currentChat._id }); 
            }
            setActiveMenuId(null); 
        } catch (err) { console.error("Lỗi react", err); } 
    };

    const handleLogout = () => {
        toast((t) => (
            <div className="flex flex-col gap-3 min-w-[250px] p-2">
                <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-500 text-2xl">
                        <i className="ri-logout-box-r-line"></i>
                    </div>
                    <p className="text-[15px] font-bold text-slate-800 text-center">Bạn muốn đăng xuất?</p>
                    <p className="text-xs text-slate-500 text-center">Bạn sẽ không nhận được tin nhắn mới nữa.</p>
                </div>
                
                <div className="flex gap-2 mt-4">
                    <button 
                        onClick={() => {
                            toast.dismiss(t.id);
                            localStorage.clear();
                            sessionStorage.clear();
                            navigate('/login', { replace: true });
                        }} 
                        className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-xl text-sm font-bold transition-colors shadow-md"
                    >
                        Đăng xuất
                    </button>
                    <button 
                        onClick={() => toast.dismiss(t.id)}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-2 rounded-xl text-sm font-bold transition-colors"
                    >
                        Hủy
                    </button>
                </div>
            </div>
        ), { 
            id: 'logout-modal',
            duration: Infinity,
            position: 'top-center' 
        });
    };

    const handleGlobalSearch = async (e) => { 
        e.preventDefault(); setSearchResult(null); 
        if (!globalSearchQuery.trim()) return; 
        try { 
            const res = await axios.get(`https://dlua-chat-api.onrender.com/api/auth/search?uniqueName=${globalSearchQuery}`); 
            setSearchResult(res.data); 
        } catch (err) { toast.error('Không tìm thấy người dùng'); } 
    };

    const handleSendRequest = async (receiverId) => { 
        try { 
            await axios.post('https://dlua-chat-api.onrender.com/api/auth/friend-request/send', { senderId: user.id, receiverId }); 
            toast.success('Đã gửi lời mời!'); setSearchResult(null); setGlobalSearchQuery(''); 
            socket.emit('send_friend_request', { receiverId }); 
        } catch (err) { toast.error('Lỗi gửi lời mời'); } 
    };

    const handleRespondRequest = async (req, status) => { 
        try { 
            await axios.post('https://dlua-chat-api.onrender.com/api/auth/friend-request/respond', { requestId: req._id, status }); 
            if (status === 'accepted') { socket.emit('accept_friend_request', { receiverId: req.sender._id }); } 
            fetchInitialData(user.id); 
        } catch (err) { console.error("Lỗi duyệt lời mời", err); } 
    };

    const handleUnfriend = (friendId) => { 
        toast((t) => ( 
            <div className="flex flex-col gap-3 min-w-[200px]">
                <p className="text-[13px] font-bold text-slate-800 text-center">Chắc chắn muốn xóa người này?</p>
                <div className="flex gap-2 mt-1">
                    <button onClick={async () => { 
                        toast.dismiss(t.id); 
                        try { 
                            await axios.post('https://dlua-chat-api.onrender.com/api/auth/unfriend', { userId: user.id, friendId }); 
                            toast.success("Đã xóa bạn bè", { duration: 2000 }); 
                            if (currentChat && currentChat._id === friendId) setCurrentChat(null); 
                            fetchFriends(user.id); 
                        } catch (err) { toast.error("Lỗi khi xóa bạn bè"); } 
                    }} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-1.5 rounded-lg text-xs font-bold transition-colors">Xóa luôn</button>
                    <button onClick={() => toast.dismiss(t.id)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-1.5 rounded-lg text-xs font-bold transition-colors">Hủy bỏ</button>
                </div>
            </div> 
        ), { id: 'unfriend-modal', duration: Infinity, position: 'top-center' }); 
    };

    const handleSaveAvatar = async () => { 
        if (editorRef.current) { 
            const canvas = editorRef.current.getImageScaledToCanvas(); 
            canvas.toBlob(async (blob) => { 
                const formData = new FormData(); 
                formData.append('file', blob, 'avatar.png'); 
                try { 
                    const uploadRes = await axios.post('https://dlua-chat-api.onrender.com/api/messages/upload', formData); 
                    const avatarUrl = uploadRes.data.url; 
                    const res = await axios.post('https://dlua-chat-api.onrender.com/api/auth/update-avatar', { userId: user.id, avatarUrl }); 
                    const updatedUser = { ...user, avatar: res.data.avatar }; 
                    setUser(updatedUser); 
                    
                    if (localStorage.getItem('user')) {
                        localStorage.setItem('user', JSON.stringify(updatedUser)); 
                    } else {
                        sessionStorage.setItem('user', JSON.stringify(updatedUser));
                    }

                    setAvatarFile(null); 
                    toast.success("Đã cập nhật Avatar!"); 
                } catch (err) { toast.error("Lỗi cập nhật Avatar"); } 
            }); 
        } 
    };

    const handleChangePassword = async (e) => { 
        e.preventDefault(); 
        try { 
            await axios.post('https://dlua-chat-api.onrender.com/api/auth/change-password', { userId: user.id, oldPassword: passwords.oldPass, newPassword: passwords.newPass }); 
            toast.success("Đổi mật khẩu thành công!"); setPasswords({ oldPass: '', newPass: '' }); 
        } catch (err) { toast.error(err.response?.data?.message || "Lỗi đổi mật khẩu"); } 
    };

    const handleCreateGroup = async (e) => {
        e.preventDefault();
        if (!newGroupName.trim() || selectedMembers.length === 0) return toast.error("Nhập tên và chọn ít nhất 1 bạn!");
        try {
            await axios.post('https://dlua-chat-api.onrender.com/api/groups/create', { name: newGroupName, members: selectedMembers, admin: user.id });
            socket.emit('new_group_created', { members: [...selectedMembers, user.id] });
            toast.success("Tạo nhóm thành công!");
            setNewGroupName(''); setSelectedMembers([]);
            fetchGroups(user.id);
            setActiveTab('chat');
        } catch (err) { toast.error("Lỗi tạo nhóm"); }
    };

    const handleLeaveGroup = () => {
        toast((t) => (
            <div className="flex flex-col gap-3 min-w-[200px]">
                <p className="text-[13px] font-bold text-slate-800 text-center">Chắc chắn thoát nhóm này?</p>
                <div className="flex gap-2 mt-1">
                    <button onClick={async () => {
                        toast.dismiss(t.id);
                        try {
                            const sysMsg = { senderId: user.id, groupId: currentChat._id, text: `${user.fullName} đã rời nhóm`, type: 'system' };
                            const resMsg = await axios.post('https://dlua-chat-api.onrender.com/api/messages/send', sysMsg);
                            const msgToSend = { ...resMsg.data, senderName: user.fullName };

                            currentChat.members.forEach(m => {
                                if (m._id !== user.id) {
                                    socket.emit('send_message', { ...msgToSend, receiverId: m._id, groupId: currentChat._id });
                                    socket.emit('leave_group', { receiverId: m._id, groupId: currentChat._id, leftUserId: user.id });
                                }
                            });

                            await axios.post('https://dlua-chat-api.onrender.com/api/groups/leave', { groupId: currentChat._id, userId: user.id });
                            toast.success("Đã rời nhóm");
                            setCurrentChat(null);
                            fetchGroups(user.id);
                        } catch (err) { toast.error("Lỗi thoát nhóm"); }
                    }} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-1.5 rounded-lg text-xs font-bold transition-colors">Thoát</button>
                    <button onClick={() => toast.dismiss(t.id)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-1.5 rounded-lg text-xs font-bold transition-colors">Hủy</button>
                </div>
            </div>
        ), { id: 'leave-group-modal', duration: Infinity, position: 'top-center' });
    };

    // ==========================================
    // WEBRTC CALL HANDLERS
    // ==========================================
    const getMedia = async (type) => { 
        try { 
            const stream = await navigator.mediaDevices.getUserMedia({ video: type === 'video', audio: true }); 
            setLocalStream(stream); 
            streamRef.current = stream;
            return stream; 
        } catch (err) { 
            toast.error("Cấp quyền Camera/Micro!"); 
            return null; 
        } 
    };

    const createPeer = (targetId, stream) => { 
        const peer = new RTCPeerConnection({ 
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: "turn:global.relay.metered.ca:80", username: "ae0da5fe20e220a4ba893339", credential: "WQ/h5RWQk6hOZevf" },
                { urls: "turn:global.relay.metered.ca:443", username: "ae0da5fe20e220a4ba893339", credential: "WQ/h5RWQk6hOZevf" },
                { urls: "turn:global.relay.metered.ca:443?transport=tcp", username: "ae0da5fe20e220a4ba893339", credential: "WQ/h5RWQk6hOZevf" }
            ] 
        }); 
        
        peerRef.current = peer; 
        stream.getTracks().forEach(track => peer.addTrack(track, stream)); 
        peer.ontrack = (e) => setRemoteStream(e.streams[0]); 
        peer.onicecandidate = (e) => { 
            if (e.candidate) socket.emit('ice_candidate', { to: targetId, candidate: e.candidate }); 
        }; 
        return peer; 
    };
    
    const startCall = async (type) => { 
        if (!currentChat || currentChat.isGroup) { toast.error("Chức năng gọi Nhóm chưa được hỗ trợ!"); return; } 
        const stream = await getMedia(type); 
        if (!stream) return; 
        
        setCallStatus('calling'); 
        setCallData({ name: currentChat.fullName, type, toId: currentChat._id }); 
        const peer = createPeer(currentChat._id, stream); 
        const offer = await peer.createOffer(); 
        await peer.setLocalDescription(offer); 
        socket.emit('call_user', { userToCall: currentChat._id, from: user.id, name: user.fullName, type, offer }); 
    };
    
    const answerCall = async () => { 
        const stream = await getMedia(callData.type); 
        if (!stream) return; 
        setCallStatus('active'); 
        
        const peer = createPeer(callData.from, stream); 
        await peer.setRemoteDescription(new RTCSessionDescription(callData.offer)); 
        
        for (let c of pendingCandidates.current) {
            try { await peer.addIceCandidate(new RTCIceCandidate(c)); } catch(e){}
        }
        pendingCandidates.current = [];

        const answer = await peer.createAnswer(); 
        await peer.setLocalDescription(answer); 
        socket.emit('answer_call', { to: callData.from, answer }); 
    };

    const endCall = () => { 
        const targetId = callStatus === 'ringing' ? callData.from : (currentChat?._id || callData?.toId); 
        socket.emit('end_call', { to: targetId }); 
        let isMissed = false, duration = 0; 
        
        if (callStatus === 'calling' || callStatus === 'ringing') isMissed = true; 
        else if (callStatus === 'active') duration = Math.floor((Date.now() - callStartTime) / 1000); 
        
        if (callStatus !== 'ringing') sendCallLog(targetId, callData.type, duration, isMissed); 
        endCallLocally(); 
    };
    
    const endCallLocally = () => { 
        if (peerRef.current) peerRef.current.close(); 
        peerRef.current = null; 
        pendingCandidates.current = []; 
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        } 
        setLocalStream(null); setRemoteStream(null); setCallStatus('idle'); setCallData(null); 
        setIsMuted(false); setIsVideoOff(false); setCallStartTime(null); 
    };

    const sendCallLog = async (receiverId, type, duration, isMissed) => { 
        const messageData = { senderId: user.id, receiverId, text: '', type: 'call_log', callDuration: duration, isMissedCall: isMissed, fileName: type }; 
        try { 
            const res = await axios.post('https://dlua-chat-api.onrender.com/api/messages/send', messageData); 
            const msgToSend = { ...res.data, senderName: user.fullName }; 
            setMessages((prev) => [...prev, msgToSend]); 
            socket.emit('send_message', msgToSend); 
            setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100); 
        } catch (err) { console.error("Lỗi Call Log", err); } 
    };

    const toggleAudio = () => { 
        if (localStream) { 
            const track = localStream.getAudioTracks()[0]; 
            if (track) { track.enabled = !track.enabled; setIsMuted(!track.enabled); } 
        } 
    };

    const toggleVideo = () => { 
        if (localStream) { 
            const track = localStream.getVideoTracks()[0]; 
            if (track) { track.enabled = !track.enabled; setIsVideoOff(!track.enabled); } 
        } 
    };

    const switchCamera = async () => {
        if (!localStream) return;
        try {
            const newMode = !isFrontCamera;
            localStream.getVideoTracks().forEach(track => track.stop());

            let stream;
            try {
                const videoConstraints = newMode ? { facingMode: "user" } : { facingMode: { exact: "environment" } };
                stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
            } catch (fallbackError) {
                stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: newMode ? "user" : "environment" } });
            }
            
            const newVideoTrack = stream.getVideoTracks()[0];
            const sender = peerRef.current.getSenders().find(s => s.track.kind === 'video');
            if (sender) sender.replaceTrack(newVideoTrack);
            
            const newLocalStream = new MediaStream([newVideoTrack, localStream.getAudioTracks()[0]]);
            setLocalStream(newLocalStream);
            setIsFrontCamera(newMode);
            setIsScreenSharing(false); 
        } catch (error) { toast.error("Thiết bị không hỗ trợ Camera này!"); }
    };

    const toggleScreenShare = async () => {
        if (!localStream) return;
        if (!navigator.mediaDevices.getDisplayMedia || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
            return toast.error("Chia sẻ màn hình chỉ hỗ trợ trên Máy tính/Laptop!");
        }

        try {
            if (isScreenSharing) {
                localStream.getVideoTracks().forEach(track => track.stop());
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: isFrontCamera ? "user" : "environment" } });
                const videoTrack = stream.getVideoTracks()[0];
                
                const sender = peerRef.current.getSenders().find(s => s.track.kind === 'video');
                if (sender) sender.replaceTrack(videoTrack);
                
                const updatedStream = new MediaStream([videoTrack, localStream.getAudioTracks()[0]]);
                setLocalStream(updatedStream);
                streamRef.current = updatedStream;
                setIsScreenSharing(false);
            } else {
                const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                const screenTrack = screenStream.getVideoTracks()[0];
                
                const sender = peerRef.current.getSenders().find(s => s.track.kind === 'video');
                if (sender) sender.replaceTrack(screenTrack);
                
                localStream.getVideoTracks().forEach(track => track.stop());
                
                const updatedStream = new MediaStream([screenTrack, localStream.getAudioTracks()[0]]);
                setLocalStream(updatedStream);
                streamRef.current = updatedStream;
                setIsScreenSharing(true);

                screenTrack.onended = async () => { 
                    setIsScreenSharing(false);
                    try {
                        const camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: isFrontCamera ? "user" : "environment" } });
                        const camTrack = camStream.getVideoTracks()[0];
                        const currentSender = peerRef.current.getSenders().find(s => s.track.kind === 'video');
                        if (currentSender) currentSender.replaceTrack(camTrack);
                        
                        const revertedStream = new MediaStream([camTrack, localStream.getAudioTracks()[0]]);
                        setLocalStream(revertedStream);
                        streamRef.current = revertedStream;
                    } catch (e) { toast.error("Vui lòng bật lại Camera!"); }
                };
            }
        } catch (error) { 
            if (error.name !== 'NotAllowedError') toast.error("Lỗi chia sẻ màn hình!"); 
        }
    };


    // ==========================================
    // RENDER: GIAO DIỆN CHÍNH
    // ==========================================
    if (!user) return null;
    const combinedChatList = [...friends, ...groups].filter(f => f.fullName.toLowerCase().includes(localChatSearch.toLowerCase()));
    const lastMessage = messages[messages.length - 1];
    
    // ĐÃ SỬA CHUẨN: Lấy điều kiện Đã xem mới bằng mảng readBy
    const isLastMessageRead = lastMessage && getSenderId(lastMessage.senderId) === user.id && (
        (lastMessage.readBy && lastMessage.readBy.length > 0) || lastMessage.isRead
    );

    return (
        <motion.div onClick={() => setActiveMenuId(null)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex h-[100dvh] bg-[#f0f4f8] dark:bg-slate-900 p-0 md:p-6 md:gap-6 font-['Be_Vietnam_Pro'] relative transition-colors duration-300 overflow-hidden">
            <Toaster position="top-center" />
            
            {/* LỚP PHỦ CUỘC GỌI */}
            {callStatus !== 'idle' && (
                <div className="fixed inset-0 bg-slate-900/95 z-[9999] flex flex-col items-center justify-center backdrop-blur-md overflow-hidden touch-none">
                    {callStatus === 'ringing' && (
                        <div className="bg-white w-[85%] max-w-md p-8 md:p-10 rounded-[32px] md:rounded-[40px] flex flex-col items-center text-center shadow-2xl animate-pulse">
                            <div className="w-20 h-20 md:w-28 md:h-28 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-4xl md:text-5xl mb-4 md:mb-6 shadow-lg shadow-blue-500/50">
                                {callData?.type === 'video' ? '📹' : '📞'}
                            </div>
                            <h3 className="text-2xl md:text-3xl font-black text-slate-800 mb-2 truncate w-full">{callData.name}</h3>
                            <p className="text-slate-500 mb-8 md:mb-10 text-base md:text-lg">Đang gọi {callData.type === 'video' ? 'Video' : 'Thoại'}...</p>
                            <div className="flex gap-4 md:gap-6 w-full justify-center">
                                <button onClick={answerCall} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-3 md:py-4 rounded-full font-bold text-base md:text-lg shadow-xl hover:scale-105 transition-all">Trả lời</button>
                                <button onClick={endCall} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 md:py-4 rounded-full font-bold text-base md:text-lg shadow-xl hover:scale-105 transition-all">Từ chối</button>
                            </div>
                        </div>
                    )}

                    {(callStatus === 'calling' || callStatus === 'active') && (
                        <div className="flex flex-col items-center w-full h-full relative">
                            {callStatus === 'calling' && (
                                <div className="absolute top-[10%] z-20 flex flex-col items-center pointer-events-none">
                                    <p className="text-white text-xl md:text-2xl font-medium animate-pulse drop-shadow-md">Đang đổ chuông...</p>
                                    <h2 className="text-white text-3xl md:text-4xl font-bold mt-2 drop-shadow-lg">{callData?.name}</h2>
                                </div>
                            )}

                            <div className="w-full h-full relative">
                                {callData?.type === 'video' ? (
                                    <div className="w-full h-full bg-black relative flex items-center justify-center">
                                        <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-contain" />
                                        <div className="absolute top-12 right-4 md:top-auto md:bottom-8 md:right-8 w-24 h-36 md:w-64 md:h-48 bg-slate-800 rounded-xl md:rounded-2xl overflow-hidden shadow-2xl border border-white/20 md:border-2 md:border-slate-600/50 z-10 cursor-pointer">
                                            <video 
                                                ref={myVideoRef} 
                                                autoPlay 
                                                playsInline 
                                                muted 
                                                className={`w-full h-full object-cover transition-all ${isScreenSharing ? '' : 'transform scale-x-[-1]'} ${isVideoOff ? 'opacity-0' : 'opacity-100'}`} 
                                            />
                                            {isVideoOff && <div className="absolute inset-0 flex items-center justify-center text-white text-2xl md:text-4xl bg-slate-800">🚫</div>}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col md:flex-row gap-8 md:gap-16 items-center justify-center w-full h-full pb-20">
                                        <div className={`w-28 h-28 md:w-40 md:h-40 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-4xl md:text-5xl text-white shadow-[0_0_50px_rgba(99,102,241,0.5)] ${callStatus === 'calling' ? 'animate-pulse' : ''}`}>
                                            {user?.avatar ? <img src={user.avatar} className="w-full h-full rounded-full object-cover"/> : user?.fullName[0]}
                                        </div>
                                        <div className="text-3xl md:text-4xl text-white animate-pulse md:animate-bounce rotate-90 md:rotate-0">〰️</div>
                                        <div className={`w-28 h-28 md:w-40 md:h-40 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-full flex items-center justify-center text-4xl md:text-5xl text-white shadow-[0_0_50px_rgba(59,130,246,0.5)] ${callStatus === 'calling' ? 'animate-pulse' : ''}`}>
                                            {callData?.name ? callData.name[0] : currentChat?.fullName[0]}
                                        </div>
                                        <audio ref={remoteVideoRef} autoPlay />
                                        <audio ref={myVideoRef} autoPlay muted />
                                    </div>
                                )}
                            </div>

                            <div className="absolute bottom-10 md:bottom-12 flex gap-4 md:gap-6 items-center bg-slate-900/60 md:bg-slate-800/80 px-6 py-3 md:px-8 md:py-4 rounded-full backdrop-blur-xl z-20 shadow-2xl border border-white/10">
                                <button onClick={toggleAudio} className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center text-xl md:text-2xl transition-all shadow-lg ${isMuted ? 'bg-white text-slate-900' : 'bg-slate-700/80 text-white hover:bg-slate-600'}`} title="Bật/Tắt Micro">{isMuted ? '🔇' : '🎤'}</button>
                                
                                {callData?.type === 'video' && (
                                    <>
                                        <button onClick={toggleVideo} className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center text-xl md:text-2xl transition-all shadow-lg ${isVideoOff ? 'bg-white text-slate-900' : 'bg-slate-700/80 text-white hover:bg-slate-600'}`} title="Bật/Tắt Camera">{isVideoOff ? '🚫' : '📹'}</button>
                                        <button onClick={switchCamera} className="w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center text-xl md:text-2xl transition-all shadow-lg bg-slate-700/80 text-white hover:bg-slate-600" title="Lật Camera">🔄</button>
                                        <button onClick={toggleScreenShare} className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center text-xl md:text-2xl transition-all shadow-lg ${isScreenSharing ? 'bg-blue-500 text-white' : 'bg-slate-700/80 text-white hover:bg-slate-600'}`} title="Chia sẻ màn hình">🖥️</button>
                                    </>
                                )}
                                
                                <button onClick={endCall} className="bg-red-500 hover:bg-red-600 text-white w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center text-2xl md:text-3xl shadow-[0_0_30px_rgba(239,68,68,0.6)] hover:scale-110 transition-all ml-2 md:ml-4">📞</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* THANH MENU */}
            <div className="hidden md:flex w-20 bg-[#0a192f] dark:bg-slate-950 rounded-[32px] flex-col items-center py-8 justify-between shadow-xl shrink-0 z-10 transition-colors">
                <div className="flex flex-col gap-6 items-center w-full">
                    <div onClick={() => setActiveTab('profile')} className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-xl cursor-pointer shadow-lg overflow-hidden transition-all ${activeTab === 'profile' ? 'ring-4 ring-blue-500 bg-blue-600' : 'bg-blue-500 hover:scale-105'}`}>{user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" alt="avatar" /> : user.fullName[0]}</div>
                    <div className="w-8 h-[1px] bg-slate-700 my-2"></div>
                    <button onClick={() => setActiveTab('chat')} className={`relative w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${activeTab === 'chat' ? 'bg-white/20 text-white shadow-inner' : 'text-slate-400 hover:text-white hover:bg-white/10'}`} title="Trò chuyện">
                        <i className="ri-chat-3-fill text-2xl"></i>
                        {Object.values(unreadCounts).some(c => c > 0) && <span className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full border-2 border-[#0a192f] animate-pulse"></span>}
                    </button>
                    <button onClick={() => setActiveTab('friends')} className={`relative w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${activeTab === 'friends' ? 'bg-white/20 text-white shadow-inner' : 'text-slate-400 hover:text-white hover:bg-white/10'}`} title="Bạn bè">
                        <i className="ri-user-smile-fill text-2xl"></i>
                        {pendingRequests.length > 0 && <span className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full border-2 border-[#0a192f] animate-pulse"></span>}
                    </button>
                    <button onClick={() => setActiveTab('groups')} className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${activeTab === 'groups' ? 'bg-white/20 text-white shadow-inner' : 'text-slate-400 hover:text-white hover:bg-white/10'}`} title="Nhóm"><i className="ri-group-fill text-2xl"></i></button>
                    <div className="w-8 h-[1px] bg-slate-700 my-2"></div>
                    <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-12 h-12 rounded-2xl flex items-center justify-center text-slate-400 hover:text-yellow-400 hover:bg-white/10 transition-all" title="Giao diện">
                        <i className={`text-2xl ${isDarkMode ? 'ri-sun-fill text-yellow-400' : 'ri-moon-fill'}`}></i>
                    </button>
                </div>
                {isInstallable && (
                    <button onClick={handleInstallClick} className="w-12 h-12 rounded-2xl flex items-center justify-center text-emerald-400 hover:text-white bg-emerald-400/10 hover:bg-emerald-500 transition-all mb-2 shadow-[0_0_15px_rgba(52,211,153,0.2)]" title="Cài đặt App">
                        <i className="ri-download-cloud-2-fill text-2xl"></i>
                    </button>
                )}
                <button onClick={handleLogout} className="text-red-400 hover:text-red-300 p-3 bg-red-400/10 rounded-2xl transition-all hover:bg-red-400/20"><i className="ri-logout-box-r-line text-2xl"></i></button>
            </div>

            {/* SIDEBAR */}
            <div className={`w-full md:w-[340px] bg-white dark:bg-slate-800 md:rounded-[32px] shadow-sm flex-col overflow-hidden border-r md:border border-slate-100 dark:border-slate-700 shrink-0 z-10 transition-colors pb-[70px] md:pb-0 ${currentChat ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-6 pt-8 md:pt-6 overflow-y-auto h-full scrollbar-hide">
                    {activeTab === 'chat' && (
                        <>
                            <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-6 tracking-tight">Trò chuyện</h2>
                            <div className="relative mb-6">
                                <i className="ri-search-line absolute left-4 top-3.5 text-slate-400 text-lg"></i>
                                <input type="text" placeholder="Tìm kiếm tin nhắn..." value={localChatSearch} onChange={(e) => setLocalChatSearch(e.target.value)} className="w-full bg-[#f8fafc] dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-2xl py-3.5 pl-11 pr-4 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-700 dark:text-slate-200" />
                            </div>
                            <div className="space-y-2">
                                {combinedChatList.length === 0 ? <p className="text-xs text-center text-slate-400 mt-10">Trống</p> : combinedChatList.map(chat => (
                                    <div key={chat._id} onClick={() => {setCurrentChat(chat); setUnreadCounts(prev => ({ ...prev, [chat._id]: 0 }));}} className={`flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition-all ${currentChat?._id === chat._id ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 shadow-sm' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 border border-transparent'}`}>
                                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 text-lg shadow-sm bg-slate-200 dark:bg-slate-600 overflow-hidden relative">
                                            {chat.avatar ? <img src={chat.avatar} className="w-full h-full object-cover"/> : (chat.isGroup ? <i className="ri-group-fill"></i> : chat.fullName[0])}
                                            {chat.isOnline && !chat.isGroup && <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-slate-800 rounded-full"></span>}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-slate-800 dark:text-white text-[15px] truncate">{chat.fullName}</p>
                                        </div>
                                        {unreadCounts[chat._id] > 0 && <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold">{unreadCounts[chat._id]}</div>}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                    {activeTab === 'groups' && (
                        <>
                            <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-6 tracking-tight">Nhóm Chat</h2>
                            <div className="bg-[#f8fafc] dark:bg-slate-900 p-4 rounded-3xl border border-slate-100 dark:border-slate-700 mb-6">
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Tạo Nhóm Mới</p>
                                <form onSubmit={handleCreateGroup} className="space-y-3">
                                    <input type="text" placeholder="Tên nhóm..." required value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl py-2.5 px-4 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 dark:text-slate-200 transition-all" />
                                    <div className="max-h-32 overflow-y-auto space-y-1">
                                        {friends.map(f => (
                                            <label key={f._id} className="flex items-center gap-3 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer">
                                                <input type="checkbox" className="accent-blue-600 w-4 h-4" checked={selectedMembers.includes(f._id)} onChange={(e) => { e.target.checked ? setSelectedMembers([...selectedMembers, f._id]) : setSelectedMembers(selectedMembers.filter(id => id !== f._id)); }} />
                                                <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-[10px] font-bold overflow-hidden">{f.avatar ? <img src={f.avatar} className="w-full h-full object-cover"/> : f.fullName[0]}</div>
                                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{f.fullName}</span>
                                            </label>
                                        ))}
                                    </div>
                                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-bold shadow-md transition-all">Tạo Nhóm</button>
                                </form>
                            </div>
                        </>
                    )}
                    {activeTab === 'friends' && (
                        <>
                            <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-6 tracking-tight">Bạn bè</h2>
                            <form onSubmit={handleGlobalSearch} className="relative mb-6">
                                <input type="text" placeholder="Tìm kiếm @ID..." value={globalSearchQuery} onChange={(e) => setGlobalSearchQuery(e.target.value)} className="w-full bg-[#f8fafc] dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-2xl py-3.5 px-5 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-700 dark:text-slate-200" />
                                <button type="submit" className="absolute right-4 top-3.5 text-blue-500 font-bold text-sm">Tìm</button>
                            </form>
                            {searchResult && (
                                <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-2xl mb-6 border border-blue-100 dark:border-blue-800 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold overflow-hidden">{searchResult.avatar ? <img src={searchResult.avatar} className="w-full h-full object-cover"/> : searchResult.fullName[0]}</div>
                                        <div><p className="font-bold text-slate-800 dark:text-white text-sm">{searchResult.fullName}</p><p className="text-[10px] text-blue-500 font-medium">{searchResult.uniqueName}</p></div>
                                    </div>
                                    {searchResult._id !== user.id && !friends.some(f => f._id === searchResult._id) && (
                                        <button onClick={() => handleSendRequest(searchResult._id)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm">Kết bạn</button>
                                    )}
                                </div>
                            )}
                            {pendingRequests.length > 0 && <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Lời mời ({pendingRequests.length})</p>}
                            {pendingRequests.map((req) => (
                                <div key={req._id} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 mb-4">
                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-2">{req.sender.fullName} muốn kết bạn</p>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleRespondRequest(req, 'accepted')} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl text-xs font-bold shadow-sm">Đồng ý</button>
                                        <button onClick={() => handleRespondRequest(req, 'rejected')} className="flex-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 py-2 rounded-xl text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-600">Từ chối</button>
                                    </div>
                                </div>
                            ))}
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 mt-6">Tất cả bạn bè ({friends.length})</p>
                            <div className="space-y-3">
                                {friends.map(friend => (
                                    <div key={friend._id} className="flex items-center justify-between p-3 rounded-2xl bg-[#f8fafc] dark:bg-slate-800/50 border border-slate-50 dark:border-slate-700/50 hover:border-slate-200 dark:hover:border-slate-600 transition-all">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-500 dark:text-slate-300 overflow-hidden">{friend.avatar ? <img src={friend.avatar} className="w-full h-full object-cover"/> : friend.fullName[0]}</div>
                                            <div><p className="font-bold text-slate-800 dark:text-slate-200 text-sm truncate max-w-[120px]">{friend.fullName}</p><p className="text-[10px] text-slate-500 dark:text-slate-400">{friend.uniqueName}</p></div>
                                        </div>
                                        <button onClick={() => handleUnfriend(friend._id)} className="text-red-400 hover:text-red-600 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 p-2 rounded-xl transition-all" title="Xóa bạn bè"><i className="ri-user-unfollow-line"></i></button>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                    {activeTab === 'profile' && (
                        <div className="flex flex-col h-full">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Hồ sơ</h2>
                                <div className="md:hidden flex gap-2">
                                    <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-600 dark:text-yellow-400 flex items-center justify-center"><i className={isDarkMode ? 'ri-sun-fill' : 'ri-moon-fill'}></i></button>
                                    <button onClick={handleLogout} className="w-10 h-10 bg-red-50 dark:bg-red-500/10 text-red-500 rounded-full flex items-center justify-center"><i className="ri-logout-box-r-line"></i></button>
                                </div>
                            </div>

                            <div className="flex flex-col items-center mb-6">
                                <input type="file" accept="image/*" ref={uploadAvatarInputRef} className="hidden" onChange={(e) => setAvatarFile(e.target.files[0])} />
                                {avatarFile ? (
                                    <div className="flex flex-col items-center bg-slate-50 dark:bg-slate-800 p-4 rounded-3xl border border-slate-100 dark:border-slate-700 w-full">
                                        <div className="rounded-2xl overflow-hidden mb-4 shadow-inner">
                                            <AvatarEditor ref={editorRef} image={avatarFile} width={150} height={150} border={0} borderRadius={20} color={[0, 0, 0, 0.6]} scale={avatarScale} />
                                        </div>
                                        <input type="range" min="1" max="3" step="0.1" value={avatarScale} onChange={(e) => setAvatarScale(parseFloat(e.target.value))} className="w-full mb-4 accent-blue-600" />
                                        <div className="flex gap-2 w-full">
                                            <button onClick={handleSaveAvatar} className="flex-1 bg-blue-600 text-white py-2 rounded-xl text-xs font-bold shadow-sm">Lưu ảnh</button>
                                            <button onClick={() => setAvatarFile(null)} className="flex-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 py-2 rounded-xl text-xs font-bold">Hủy</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="relative group cursor-pointer" onClick={() => uploadAvatarInputRef.current.click()}>
                                        <div className="w-24 h-24 rounded-[32px] bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900 dark:to-indigo-900 flex items-center justify-center text-blue-600 dark:text-blue-300 font-black text-4xl shadow-md overflow-hidden border-4 border-white dark:border-slate-800 ring-1 ring-slate-100 dark:ring-slate-700">
                                            {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : user.fullName[0]}
                                        </div>
                                        <div className="absolute inset-0 bg-black/40 rounded-[32px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><i className="ri-camera-fill text-white text-2xl"></i></div>
                                    </div>
                                )}
                                <h3 className="text-xl font-bold text-slate-800 dark:text-white mt-4">{user.fullName}</h3>
                                <p className="text-blue-500 dark:text-blue-400 font-medium text-sm bg-blue-50 dark:bg-blue-500/10 px-3 py-1 rounded-lg mt-1">{user.uniqueName}</p>
                                <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">@{user.username}</p>
                            </div>

                            {isInstallable && (
                                <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-4 rounded-[24px] mb-6 flex items-center justify-between shadow-lg shadow-emerald-500/20 md:hidden">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white text-xl backdrop-blur-sm"><i className="ri-smartphone-line"></i></div>
                                        <div>
                                            <p className="font-bold text-white text-sm">Cài đặt DluaChat</p>
                                            <p className="text-emerald-100 text-[10px]">Thêm vào màn hình chính</p>
                                        </div>
                                    </div>
                                    <button onClick={handleInstallClick} className="bg-white text-emerald-600 px-4 py-2 rounded-xl text-xs font-bold shadow-sm active:scale-95 transition-all">Tải ngay</button>
                                </div>
                            )}

                            <div className="bg-[#f8fafc] dark:bg-slate-900 p-5 rounded-[24px] border border-slate-100 dark:border-slate-800">
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">Đổi mật khẩu</p>
                                <form onSubmit={handleChangePassword} className="space-y-3">
                                    <input type="password" placeholder="Mật khẩu cũ" required value={passwords.oldPass} onChange={(e) => setPasswords({...passwords, oldPass: e.target.value})} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl py-2.5 px-4 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                                    <input type="password" placeholder="Mật khẩu mới" required value={passwords.newPass} onChange={(e) => setPasswords({...passwords, newPass: e.target.value})} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl py-2.5 px-4 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                                    <button type="submit" className="w-full bg-[#0a192f] dark:bg-blue-600 hover:bg-blue-600 text-white py-3 rounded-xl text-sm font-bold shadow-md transition-all mt-2">Cập nhật</button>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* MAIN CHAT AREA */}
            <div className={`w-full md:flex-1 bg-white dark:bg-slate-800 md:rounded-[32px] shadow-sm flex-col overflow-hidden relative transition-colors ${!currentChat ? 'hidden md:flex' : 'flex absolute inset-0 z-50 md:relative md:z-0'}`}>
                {!currentChat ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center px-10">
                        <div className="w-24 h-24 bg-[#f8fafc] dark:bg-slate-900 rounded-[40px] flex items-center justify-center mb-8 shadow-inner border border-white dark:border-slate-700 text-5xl">✨</div>
                        <h3 className="text-3xl font-bold text-slate-800 dark:text-white mb-3">DluaChat Pro</h3>
                        <p className="text-slate-400 max-w-sm text-[15px]">Đã Sẵn Sàng!</p>
                    </div>
                ) : (
                    <>
                        <div className="h-[80px] border-b border-slate-100 dark:border-slate-700 flex items-center justify-between px-4 md:px-8 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md z-10 sticky top-0 transition-colors pt-safe">
                            <div className="flex items-center gap-3">
                                <button onClick={() => setCurrentChat(null)} className="md:hidden w-10 h-10 flex items-center justify-center text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-all">
                                    <i className="ri-arrow-left-s-line text-3xl"></i>
                                </button>
                                <div className="w-11 h-11 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center font-bold text-slate-500 dark:text-slate-300 overflow-hidden relative">
                                    {currentChat.avatar ? <img src={currentChat.avatar} className="w-full h-full object-cover"/> : (currentChat.isGroup ? <i className="ri-group-fill"></i> : currentChat.fullName[0])}
                                    {currentChat.isOnline && !currentChat.isGroup && <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-800 rounded-full"></span>}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-white text-[15px] truncate max-w-[120px] md:max-w-full">{currentChat.fullName}</h3>
                                    {!currentChat.isGroup && (
                                        currentChat.isOnline ? <p className="text-[10px] text-emerald-500 font-medium">Đang hoạt động</p> : <p className="text-[10px] text-slate-400 font-medium">{formatLastSeen(currentChat?.lastSeen)}</p>
                                    )}
                                    {currentChat.isGroup && <p className="text-[10px] text-slate-400 font-medium">{currentChat.members?.length} thành viên</p>}
                                </div>
                            </div>
                            <div className="flex gap-2 md:gap-3 items-center">
                                {currentChat.isGroup && <button onClick={handleLeaveGroup} className="text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 px-3 py-1.5 md:px-4 md:py-2 rounded-xl text-xs md:text-sm font-bold transition-all shadow-sm">Thoát</button>}
                                {!currentChat.isGroup && <button onClick={() => startCall('audio')} className="w-9 h-9 md:w-11 md:h-11 bg-slate-50 dark:bg-slate-700 border border-slate-100 dark:border-slate-600 text-indigo-500 dark:text-indigo-400 rounded-full flex items-center justify-center text-lg md:text-xl transition-all shadow-sm">📞</button>}
                                {!currentChat.isGroup && <button onClick={() => startCall('video')} className="w-9 h-9 md:w-11 md:h-11 bg-slate-50 dark:bg-slate-700 border border-slate-100 dark:border-slate-600 text-blue-500 dark:text-blue-400 rounded-full flex items-center justify-center text-lg md:text-xl transition-all shadow-sm">📹</button>}
                            </div>
                        </div>

                        <div ref={chatContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#f8fafc] dark:bg-slate-900 space-y-4 transition-colors">
                            {isLoadingMore && <div className="flex justify-center py-2"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>}

                            {messages.map((msg, index) => {
                                const isMe = getSenderId(msg.senderId) === user.id;
                                const prevMsg = messages[index - 1];
                                const showTime = shouldShowTime(msg, prevMsg);
                                
                                if (msg.type === 'system') return (
                                    <div key={index} className="flex justify-center my-3">
                                        <div className="bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 text-[11px] px-4 py-1.5 rounded-full font-medium shadow-sm">{msg.text}</div>
                                    </div>
                                );
                                if (msg.type === 'call_log') return (
                                    <div key={index} className="flex flex-col items-center my-6">
                                        {showTime && <span className="text-[11px] text-slate-400 font-medium mb-3">{formatMessageTime(msg.createdAt)}</span>}
                                        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm rounded-2xl p-4 w-64 flex flex-col items-center text-center">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg mb-2 ${msg.isMissedCall ? 'bg-red-50 text-red-500' : 'bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-300'}`}>{msg.fileName === 'video' ? '📹' : '📞'}</div>
                                            <p className={`font-bold text-sm ${msg.isMissedCall ? 'text-red-500' : 'text-slate-800 dark:text-white'}`}>{msg.isMissedCall ? 'Bỏ lỡ cuộc gọi' : 'Cuộc gọi kết thúc'}</p>
                                            {!msg.isMissedCall && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{formatCallDuration(msg.callDuration)}</p>}
                                        </div>
                                    </div>
                                );

                                return (
                                    <div key={index} id={`msg-${msg._id}`} className="flex flex-col transition-colors duration-500">
                                        {showTime && <span className="text-[11px] text-slate-400 font-medium mb-3 text-center w-full block">{formatMessageTime(msg.createdAt)}</span>}
                                        
                                        <div className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'} group relative mb-2`}>
                                            
                                            {!isMe && currentChat.isGroup && msg.senderId && (
                                                <div className="flex flex-col items-center gap-1 mb-1 mr-1">
                                                    <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold overflow-hidden shadow-sm">
                                                        {msg.senderId.avatar ? <img src={msg.senderId.avatar} className="w-full h-full object-cover" /> : msg.senderId.fullName[0]}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="relative max-w-[85%] md:max-w-[75%] flex flex-col gap-1.5" onContextMenu={(e) => { e.preventDefault(); setActiveMenuId(activeMenuId === msg._id ? null : msg._id); }}>
                                                {!isMe && currentChat.isGroup && msg.senderId && <span className="text-[10px] text-slate-500 dark:text-slate-400 ml-2 font-medium">{msg.senderId.fullName}</span>}
                                                {msg.isUnsent ? (
                                                    <div className={`py-2 px-4 rounded-[22px] text-[14px] italic border ${isMe ? 'bg-transparent border-slate-300 dark:border-slate-600 text-slate-400 ml-auto' : 'bg-transparent border-slate-300 dark:border-slate-600 text-slate-400 mr-auto'}`}>
                                                        🚫 Tin nhắn đã được thu hồi
                                                    </div>
                                                ) : (
                                                    <>
                                                        {msg.replyTo && !msg.replyTo.isUnsent && (
                                                            <div 
                                                                onClick={() => {
                                                                    const target = document.getElementById(`msg-${msg.replyTo._id}`);
                                                                    if(target) {
                                                                        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                                        target.classList.add('bg-blue-50', 'dark:bg-blue-900/50', 'rounded-2xl', 'p-1');
                                                                        setTimeout(() => target.classList.remove('bg-blue-50', 'dark:bg-blue-900/50', 'rounded-2xl', 'p-1'), 1500);
                                                                    }
                                                                }}
                                                                className={`cursor-pointer text-[12px] mb-1 px-3 py-1.5 rounded-xl max-w-full line-clamp-1 opacity-80 hover:opacity-100 transition-opacity ${isMe ? 'bg-indigo-100 text-indigo-800 self-end' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 self-start'}`}
                                                            >
                                                                ↩ {msg.replyTo.text || "Đã trả lời đính kèm"}
                                                            </div>
                                                        )}
                                                        
                                                        {/* NỘI DUNG CHÍNH CỦA TIN NHẮN */}
                                                        {msg.imageUrl && <img src={msg.imageUrl} className={`max-w-full h-auto max-h-56 object-cover rounded-2xl shadow-sm ${isMe ? 'ml-auto' : 'mr-auto'}`} />}
                                                        {msg.videoUrl && <video src={msg.videoUrl} controls className={`max-w-full h-auto max-h-56 rounded-2xl shadow-sm bg-black ${isMe ? 'ml-auto' : 'mr-auto'}`} />}
                                                        {msg.fileUrl && <a href={msg.fileUrl} target="_blank" rel="noreferrer" className={`flex items-center gap-2 p-3 rounded-2xl transition-all text-sm font-medium shadow-sm w-fit ${isMe ? 'bg-indigo-50 text-indigo-700 ml-auto' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 mr-auto'}`}>📎 <span className="truncate max-w-[150px]">{msg.fileName}</span></a>}
                                                        {msg.text && <div className={`py-2 px-4 rounded-[22px] text-[15px] shadow-sm w-fit max-w-full break-words whitespace-pre-wrap ${isMe ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-sm ml-auto' : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-600 rounded-tl-sm mr-auto'}`}>{msg.text}</div>}
                                                        {msg.reactions && msg.reactions.length > 0 && <div className={`absolute -bottom-3 ${isMe ? 'right-2' : 'left-2'} bg-white border border-slate-100 shadow-md rounded-full px-2 py-0.5 text-xs flex gap-1 z-10`}>{msg.reactions.map((r, i) => <span key={i}>{r.emoji}</span>)}</div>}
                                                        <div className={`absolute top-[100%] mt-2 flex items-center gap-1.5 transition-all duration-200 bg-white border border-slate-200 shadow-lg rounded-full px-3 py-1.5 z-30 ${activeMenuId === msg._id ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible -translate-y-2'} ${isMe ? 'right-0' : 'left-0'}`}>
                                                            <button onClick={(e) => { e.stopPropagation(); setReplyingTo(msg); setActiveMenuId(null); }} className="hover:bg-slate-100 p-1.5 rounded-full text-sm">↩️</button>
                                                            <button onClick={(e) => { e.stopPropagation(); handleReact(msg._id, '❤️'); setActiveMenuId(null); }} className="hover:bg-slate-100 p-1.5 rounded-full text-sm">❤️</button>
                                                            <button onClick={(e) => { e.stopPropagation(); handleReact(msg._id, '😂'); setActiveMenuId(null); }} className="hover:bg-slate-100 p-1.5 rounded-full text-sm">😂</button>
                                                            {isMe && <button onClick={(e) => { e.stopPropagation(); handleUnsend(msg._id); setActiveMenuId(null); }} className="hover:bg-red-50 p-1.5 rounded-full text-sm text-red-500">🗑️</button>}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            
                            {typingUsers[currentChat._id] && (
                                <div className="flex justify-start mb-2">
                                    <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-3xl p-3 px-4 shadow-sm w-fit flex gap-1 items-center">
                                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                                    </div>
                                </div>
                            )}

                            {isLastMessageRead && !currentChat.isGroup && (
                                <div className="flex justify-end mt-1 pr-2 mb-2">
                                    <div className="flex items-center gap-1.5 opacity-70">
                                        <div className="w-3 h-3 rounded-full overflow-hidden border border-slate-200">
                                            {currentChat.avatar ? (
                                                <img src={currentChat.avatar} className="w-full h-full object-cover" alt="seen-avatar" />
                                            ) : (
                                                <div className="w-full h-full bg-slate-300 flex items-center justify-center text-[8px] text-white">
                                                    {currentChat.fullName[0]}
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-[10px] text-slate-500 font-medium">
                                            {formatReadTime(lastMessage.readAt)}
                                        </span>
                                    </div>
                                </div>
                            )}
                            <div ref={scrollRef} />
                        </div>

                        <div className="bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 p-3 md:p-4 transition-colors pb-safe">
                            {replyingTo && (
                                <div className="mb-3 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 rounded-xl flex justify-between items-center">
                                    <div>
                                        <p className="text-[10px] font-bold text-indigo-500 uppercase">Đang trả lời</p>
                                        <p className="text-xs text-slate-600 dark:text-slate-300 truncate max-w-[200px] md:max-w-sm">{replyingTo.text || "Một đính kèm"}</p>
                                    </div>
                                    <button onClick={() => setReplyingTo(null)} className="text-slate-400 hover:text-red-500 font-bold p-1">✕</button>
                                </div>
                            )}
                            
                            <div className="flex items-center gap-1 md:gap-2 h-12 w-full">
                                <input type="file" accept="image/*" ref={imageInputRef} className="hidden" onChange={(e) => handleFileUpload(e, 'image')} />
                                <input type="file" accept=".pdf,.doc,.docx,.zip,.txt" ref={fileInputRef} className="hidden" onChange={(e) => handleFileUpload(e, 'file')} />
                                <input type="file" accept="video/mp4,video/webm,video/ogg" ref={videoInputRef} className="hidden" onChange={(e) => handleFileUpload(e, 'video')} />
                                
                                <div className="flex items-center relative">
                                    <div className="md:hidden relative">
                                        <button type="button" onClick={() => setShowAttachmentMenu(!showAttachmentMenu)} className="text-slate-400 hover:text-blue-500 dark:text-slate-500 dark:hover:text-blue-400 transition-all w-9 h-9 rounded-full flex items-center justify-center text-2xl">
                                            <i className={`ri-add-circle-${showAttachmentMenu ? 'fill text-blue-500' : 'line'}`}></i>
                                        </button>

                                        {showAttachmentMenu && (
                                            <div className="absolute bottom-[130%] left-0 z-50 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] rounded-2xl p-2 flex flex-col gap-1 w-[160px] origin-bottom-left transition-all">
                                                <button type="button" onClick={() => { imageInputRef.current.click(); setShowAttachmentMenu(false); }} className="flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700 p-2 rounded-xl text-[13px] font-bold text-slate-700 dark:text-slate-200 transition-colors">
                                                    <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-slate-700 text-blue-500 flex items-center justify-center text-lg"><i className="ri-image-add-fill"></i></div>
                                                    Gửi hình ảnh
                                                </button>
                                                <button type="button" onClick={() => { videoInputRef.current.click(); setShowAttachmentMenu(false); }} className="flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700 p-2 rounded-xl text-[13px] font-bold text-slate-700 dark:text-slate-200 transition-colors">
                                                    <div className="w-8 h-8 rounded-full bg-purple-50 dark:bg-slate-700 text-purple-500 flex items-center justify-center text-lg"><i className="ri-video-add-fill"></i></div>
                                                    Gửi Video
                                                </button>
                                                <button type="button" onClick={() => { fileInputRef.current.click(); setShowAttachmentMenu(false); }} className="flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700 p-2 rounded-xl text-[13px] font-bold text-slate-700 dark:text-slate-200 transition-colors">
                                                    <div className="w-8 h-8 rounded-full bg-orange-50 dark:bg-slate-700 text-orange-500 flex items-center justify-center text-lg"><i className="ri-attachment-2"></i></div>
                                                    Gửi Tập tin
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="hidden md:flex gap-1 items-center">
                                        <button type="button" onClick={() => imageInputRef.current.click()} className="text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 transition-all w-10 h-10 rounded-full flex items-center justify-center text-xl"><i className="ri-image-add-fill"></i></button>
                                        <button type="button" onClick={() => videoInputRef.current.click()} className="text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 transition-all w-10 h-10 rounded-full flex items-center justify-center text-xl"><i className="ri-video-add-fill"></i></button>
                                        <button type="button" onClick={() => fileInputRef.current.click()} className="text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 transition-all w-10 h-10 rounded-full flex items-center justify-center text-xl"><i className="ri-attachment-2"></i></button>
                                    </div>

                                    <div className="relative">
                                        <button type="button" onClick={() => setShowEmoji(!showEmoji)} className="text-slate-400 hover:text-yellow-500 dark:text-slate-500 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-slate-700 transition-all w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center text-xl"><i className="ri-emotion-happy-fill"></i></button>
                                        {showEmoji && <div className="absolute bottom-[130%] left-0 md:-left-20 z-50 shadow-2xl scale-90 origin-bottom-left"><EmojiPicker theme={isDarkMode ? 'dark' : 'light'} onEmojiClick={(e) => { setNewMessage(prev => prev + e.emoji); setShowEmoji(false); }} /></div>}
                                    </div>
                                </div>

                                <form onSubmit={handleSendMessage} className="flex-1 flex gap-2 md:gap-3 h-full items-center ml-1 md:ml-2">
                                    <input type="text" placeholder="Nhắn tin..." value={newMessage} 
                                        onChange={(e) => { setNewMessage(e.target.value); socket.emit('typing', { senderId: user.id, receiverId: currentChat._id }); if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current); typingTimeoutRef.current = setTimeout(() => socket.emit('stop_typing', { senderId: user.id, receiverId: currentChat._id }), 2000); }} 
                                        className="flex-1 h-full bg-[#f0f4f8] dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-full px-4 md:px-5 text-[14px] md:text-[15px] outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-700 dark:text-slate-200" 
                                    />
                                    <button type="submit" className="w-10 h-10 md:w-12 md:h-12 bg-[#0a192f] dark:bg-blue-600 hover:bg-blue-600 dark:hover:bg-blue-500 text-white rounded-full flex items-center justify-center transition-all shadow-md active:scale-95 shrink-0">
                                        <i className="ri-send-plane-fill text-lg md:text-xl relative right-[1px]"></i>
                                    </button>
                                </form>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* BOTTOM NAV MOBILE */}
            {!currentChat && (
                <div className="md:hidden fixed bottom-0 left-0 w-full h-[70px] bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex items-center justify-around z-40 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] pb-safe px-2 transition-colors">
                    <button onClick={() => setActiveTab('chat')} className={`relative flex flex-col items-center gap-1 w-16 ${activeTab === 'chat' ? 'text-blue-600 dark:text-blue-500' : 'text-slate-400 dark:text-slate-500'}`}>
                        <div className="relative">
                            <i className={`${activeTab === 'chat' ? 'ri-chat-3-fill' : 'ri-chat-3-line'} text-2xl`}></i>
                            {Object.values(unreadCounts).some(c => c > 0) && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-white dark:border-slate-950"></span>}
                        </div>
                        <span className="text-[10px] font-bold">Chat</span>
                    </button>
                    <button onClick={() => setActiveTab('friends')} className={`relative flex flex-col items-center gap-1 w-16 ${activeTab === 'friends' ? 'text-blue-600 dark:text-blue-500' : 'text-slate-400 dark:text-slate-500'}`}>
                        <div className="relative">
                            <i className={`${activeTab === 'friends' ? 'ri-user-smile-fill' : 'ri-user-smile-line'} text-2xl`}></i>
                            {pendingRequests.length > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-white dark:border-slate-950"></span>}
                        </div>
                        <span className="text-[10px] font-bold">Bạn bè</span>
                    </button>
                    <button onClick={() => setActiveTab('groups')} className={`flex flex-col items-center gap-1 w-16 ${activeTab === 'groups' ? 'text-blue-600 dark:text-blue-500' : 'text-slate-400 dark:text-slate-500'}`}>
                        <i className={`${activeTab === 'groups' ? 'ri-group-fill' : 'ri-group-line'} text-2xl`}></i>
                        <span className="text-[10px] font-bold">Nhóm</span>
                    </button>
                    <button onClick={() => setActiveTab('profile')} className="flex flex-col items-center gap-1 w-16">
                        <div className={`w-7 h-7 rounded-full overflow-hidden border-2 ${activeTab === 'profile' ? 'border-blue-600 dark:border-blue-500' : 'border-transparent'}`}>
                            {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover"/> : <div className="w-full h-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">{user.fullName[0]}</div>}
                        </div>
                        <span className={`text-[10px] font-bold ${activeTab === 'profile' ? 'text-blue-600 dark:text-blue-500' : 'text-slate-400 dark:text-slate-500'}`}>Hồ sơ</span>
                    </button>
                </div>
            )}
        </motion.div>
    );
}