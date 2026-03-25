import EditingChatBubble from "@/components/EditingChatBubble";
import System from "@/models/system";
import showToast from "@/utils/toast";
import { Plus } from "@phosphor-icons/react/dist/csr/Plus";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export default function CustomMessages() {
  const { t } = useTranslation();
  const [hasChanges, setHasChanges] = useState(false);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    async function fetchMessages() {
      const messages = await System.getWelcomeMessages();
      setMessages(messages);
    }
    fetchMessages();
  }, []);

  const addMessage = (type) => {
    if (type === "user") {
      setMessages([
        ...messages,
        {
          user: t("customization.items.welcome-messages.double-click"),
          response: "",
        },
      ]);
    } else {
      setMessages([
        ...messages,
        {
          user: "",
          response: t("customization.items.welcome-messages.double-click"),
        },
      ]);
    }
  };

  const removeMessage = (index) => {
    setHasChanges(true);
    setMessages(messages.filter((_, i) => i !== index));
  };

  const handleMessageChange = (index, type, value) => {
    setHasChanges(true);
    const newMessages = [...messages];
    newMessages[index][type] = value;
    setMessages(newMessages);
  };

  const handleMessageSave = async () => {
    const { success, error } = await System.setWelcomeMessages(messages);
    if (!success) {
      showToast(`Failed to update welcome messages: ${error}`, "error");
      return;
    }
    showToast("Successfully updated welcome messages.", "success");
    setHasChanges(false);
  };

  return (
    <section className="prism-settings-field flex flex-col gap-y-0.5">
      <p className="prism-settings-field-title mt-0">
        {t("customization.items.welcome-messages.title")}
      </p>
      <p className="prism-settings-field-copy mt-0">
        {t("customization.items.welcome-messages.description")}
      </p>
      <div className="prism-settings-panel-flat mt-3 flex flex-col gap-y-6 pr-[31px] pl-[12px] pt-4 max-w-[700px]">
        {messages.map((message, index) => (
          <div key={index} className="flex flex-col gap-y-2">
            {message.user && (
              <EditingChatBubble
                message={message}
                index={index}
                type="user"
                handleMessageChange={handleMessageChange}
                removeMessage={removeMessage}
              />
            )}

            {message.response && (
              <EditingChatBubble
                message={message}
                index={index}
                type="response"
                handleMessageChange={handleMessageChange}
                removeMessage={removeMessage}
              />
            )}
          </div>
        ))}
        <div className="flex gap-4 mt-12 justify-between pb-[15px]">
          <button
            className="border-none self-end text-theme-text-primary hover:text-theme-text-secondary transition"
            onClick={() => addMessage("response")}
          >
            <div className="flex items-center justify-start text-sm font-normal -ml-2">
              <Plus className="m-2" size={16} weight="bold" />
              <span className="leading-5">
                {t("customization.items.welcome-messages.new")}{" "}
                <span className="font-bold italic mr-1">
                  {t("customization.items.welcome-messages.system")}
                </span>{" "}
                {t("customization.items.welcome-messages.message")}
              </span>
            </div>
          </button>
          <button
            className="border-none self-end text-theme-text-primary hover:text-theme-text-secondary transition"
            onClick={() => addMessage("user")}
          >
            <div className="flex items-center justify-start text-sm font-normal">
              <Plus className="m-2" size={16} weight="bold" />
              <span className="leading-5">
                {t("customization.items.welcome-messages.new")}{" "}
                <span className="font-bold italic mr-1">
                  {t("customization.items.welcome-messages.user")}
                </span>{" "}
                {t("customization.items.welcome-messages.message")}
              </span>
            </div>
          </button>
        </div>
      </div>
      {hasChanges && (
        <div className="flex justify-start pt-2">
          <button
            className="transition-all duration-300 border border-theme-sidebar-border px-4 py-2 rounded-full text-theme-text-primary text-sm items-center flex gap-x-2 hover:bg-theme-sidebar-item-hover focus:ring-gray-800"
            onClick={handleMessageSave}
          >
            {t("customization.items.welcome-messages.save")}
          </button>
        </div>
      )}
    </section>
  );
}
