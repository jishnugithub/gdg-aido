import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Send,
  Image as ImageIcon,
  Check,
  CheckCheck,
  Phone,
  Briefcase,
  Loader2,
  X,
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useChat } from '@/hooks/useChat';
import { uploadImage } from '@/lib/storage';
import { Avatar } from '@/components/ui/Avatar';
import type { Job, User as UserType } from '@/types';

export const ChatPage: React.FC = () => {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // In Aidmate, conversationId is typically the jobId
  const activeChatId = conversationId || 'general';
  const { messages, loading, sending, sendMessage } = useChat(activeChatId);

  const [inputMessage, setInputMessage] = useState('');
  const [job, setJob] = useState<Job | null>(null);
  const [otherUser, setOtherUser] = useState<UserType | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch Job Context & Participant Info
  useEffect(() => {
    if (!conversationId) return;

    const fetchContext = async () => {
      try {
        const jobSnap = await getDoc(doc(db, 'jobs', conversationId));
        if (jobSnap.exists()) {
          const jobData = { jobId: jobSnap.id, ...jobSnap.data() } as Job;
          setJob(jobData);

          const otherUserId =
            jobData.requesterId === user?.uid ? jobData.aidmateId : jobData.requesterId;

          if (otherUserId) {
            const uSnap = await getDoc(doc(db, 'users', otherUserId));
            if (uSnap.exists()) {
              setOtherUser(uSnap.data() as UserType);
            }
          }
        }
      } catch (err) {
        console.error('[ChatPage] Error fetching context:', err);
      }
    };

    fetchContext();
  }, [conversationId, user?.uid]);

  // Auto-scroll to bottom whenever new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = inputMessage.trim();
    if (!text && !selectedFile) return;

    try {
      let mediaURL: string | undefined = undefined;
      if (selectedFile) {
        setIsUploadingImage(true);
        mediaURL = await uploadImage(
          selectedFile,
          `chats/${activeChatId}/${Date.now()}_${selectedFile.name}`
        );
        setSelectedFile(null);
        setFilePreview(null);
      }

      setInputMessage('');
      await sendMessage(text, mediaURL);
    } catch (err) {
      console.error('[ChatPage] Send failed:', err);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setFilePreview(URL.createObjectURL(file));
    }
  };

  const formatMessageTime = (date: Date): string => {
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-screen bg-[#F8F9FE] text-[#1A1D3E]">
      {/* Top Chat Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 py-2.5 shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-1.5 -ml-1 text-slate-500 hover:text-[#1A1D3E] hover:bg-slate-100 rounded-xl"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <Avatar
            src={otherUser?.photoURL || undefined}
            name={otherUser?.fullName || 'Aidmate'}
            size="sm"
          />

          <div className="truncate">
            <h2 className="text-sm font-bold text-[#1A1D3E] truncate">
              {otherUser?.fullName || 'Aidmate Assistant'}
            </h2>
            {job && (
              <p className="text-[11px] text-slate-400 truncate flex items-center gap-1">
                <Briefcase className="w-3 h-3 text-[#FF6B4A]" />
                <span className="truncate">{job.title}</span>
              </p>
            )}
          </div>
        </div>

        {/* Call button if phone exists */}
        {otherUser?.phoneNumber && (
          <a
            href={`tel:${otherUser.phoneNumber}`}
            aria-label="Call partner"
            className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-colors flex items-center justify-center shrink-0"
          >
            <Phone className="w-4 h-4" />
          </a>
        )}
      </header>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-[#FF6B4A]" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            No messages yet. Send a friendly greeting to start the conversation!
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.senderId === user?.uid;

            return (
              <div
                key={msg.messageId}
                className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[78%] sm:max-w-md rounded-2xl px-4 py-2.5 shadow-xs text-sm leading-relaxed ${
                    isMine
                      ? 'bg-[#FF6B4A] text-white rounded-br-xs'
                      : 'bg-white text-[#1A1D3E] border border-slate-200/80 rounded-bl-xs'
                  }`}
                >
                  {/* Attached Image */}
                  {msg.mediaURL && (
                    <div className="rounded-xl overflow-hidden mb-2 max-h-60 bg-black/10">
                      <img
                        src={msg.mediaURL}
                        alt="Shared media"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  {/* Text content */}
                  {msg.message && <p className="break-words">{msg.message}</p>}

                  {/* Timestamp & Read Receipt */}
                  <div
                    className={`flex items-center justify-end gap-1 text-[10px] mt-1 ${
                      isMine ? 'text-white/80' : 'text-slate-400'
                    }`}
                  >
                    <span>{formatMessageTime(msg.createdAt)}</span>
                    {isMine &&
                      (msg.readAt ? (
                        <CheckCheck className="w-3.5 h-3.5 text-white" />
                      ) : (
                        <Check className="w-3.5 h-3.5 text-white/70" />
                      ))}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Image Preview bar before sending */}
      {filePreview && (
        <div className="p-2 bg-white border-t border-slate-200 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <img
              src={filePreview}
              alt="Preview"
              className="w-12 h-12 rounded-xl object-cover border border-slate-200"
            />
            <span className="text-xs text-slate-500">Image ready to send</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedFile(null);
              setFilePreview(null);
            }}
            className="p-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input Bar */}
      <footer className="sticky bottom-0 bg-white border-t border-slate-200/80 p-3 sm:p-4">
        <form onSubmit={handleSend} className="max-w-3xl mx-auto flex items-center gap-2">
          {/* Image attachment button */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 rounded-2xl text-slate-400 hover:text-[#FF6B4A] hover:bg-[#FFF8F5] transition-colors"
          >
            <ImageIcon className="w-5 h-5" />
          </button>

          {/* Text Input */}
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-slate-100/80 border border-transparent focus:border-[#FF6B4A] focus:bg-white focus:ring-4 focus:ring-[#FF6B4A]/20 rounded-2xl px-4 py-2.5 text-sm text-[#1A1D3E] outline-none transition-all placeholder:text-slate-400"
          />

          {/* Send Button */}
          <button
            type="submit"
            disabled={(!inputMessage.trim() && !selectedFile) || sending || isUploadingImage}
            className="w-11 h-11 rounded-2xl bg-[#FF6B4A] text-white flex items-center justify-center hover:bg-[#E85A3A] disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-[#FF6B4A]/25 transition-all shrink-0"
          >
            {sending || isUploadingImage ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4 ml-0.5" />
            )}
          </button>
        </form>
      </footer>
    </div>
  );
};

export default ChatPage;
