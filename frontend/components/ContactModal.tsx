import React from 'react';
// 1. 删除了 import { FiX } from "react-icons/fi"; 这一行

interface ContactModalProps {
  onClose: () => void;
}

const ContactModal: React.FC<ContactModalProps> = ({ onClose }) => {
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg p-6 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Contact Us</h2>
          {/* 2. 把图标组件换成了简单的文字按钮 */}
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold leading-none"
          >
            &times; {/* 这是一个乘号，看起来像 X */}
          </button>
        </div>
        <p className="text-gray-600 mb-6">
          如需商务合作、数据纠错或技术支持，请通过以下方式联系我们：
        </p>
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <span>📧</span>
            <span>contact@factorymap.app</span>
          </div>
          <div className="flex items-center space-x-3">
            <span>🌐</span>
            <span>China Factory Map — B2B supplier directory</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactModal;