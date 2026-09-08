import { initAuth } from "./assets/js/auth.js";
import { initAssessment } from "./assets/js/assessment.js";
import { initContact } from "./assets/js/contact.js";
import { initMeeting } from "./assets/js/meeting.js";
import { initProfile } from "./assets/js/profile.js";
import { openModal } from "./assets/js/supabase-client.js";

const toggle = document.querySelector("[data-menu-toggle]");
const nav = document.querySelector("[data-nav]");
const revealItems = document.querySelectorAll("[data-reveal]");

if (toggle && nav) {
  toggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-label", isOpen ? "Đóng menu" : "Mở menu");
  });
  nav.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-label", "Mở menu");
    }
  });
}

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}

initAuth();
initContact();
initMeeting();
initAssessment();
initProfile();
initLegalFooter();
initToolsEntry();

function initToolsEntry(){
  const mainNav=document.querySelector('[data-nav]');
  if(mainNav&&!mainNav.querySelector('a[href="cong-cu-tro-choi.html"]')){
    const link=document.createElement('a');link.href='cong-cu-tro-choi.html';link.textContent='Công cụ';
    const contactLink=mainNav.querySelector('a[data-open-contact]');mainNav.insertBefore(link,contactLink||null);
  }
  const contact=document.querySelector('#lien-he');
  if(!contact||document.querySelector('#cong-cu'))return;
  const section=document.createElement('section');
  section.id='cong-cu';section.className='section contact dark-surface is-visible';
  section.innerHTML=`<div class="contact-panel"><div><p class="eyebrow">Công cụ & trò chơi đầu tư</p><h3>Không cần đoán mã. Hãy thử nhìn lại chính cách mình đang đầu tư.</h3><h2>Chơi nhanh để thấy rủi ro, kỷ luật và lỗi quy trình.</h2><p>Investor Score, Risk Budget Game và Mổ xẻ một lệnh thua. Có thể dùng không cần đăng nhập.</p></div><div class="contact-form assessment-entry"><a class="button button-primary" href="cong-cu-tro-choi.html">Mở kho công cụ & trò chơi</a><a class="button button-secondary" href="investor-score.html">Bắt đầu với Investor Score</a><small class="privacy-note">Khi chơi, hệ thống chỉ ghi dữ liệu hành vi ẩn danh để cải thiện trải nghiệm. Nếu sau đó anh/chị chủ động gửi Assessment/yêu cầu trên cùng trình duyệt, lịch sử tool có thể được nối với hồ sơ để hỗ trợ trao đổi phù hợp hơn.</small></div></div>`;
  contact.parentNode.insertBefore(section,contact);
}

const legalDocs = {
  disclaimer: {
    title: "Miễn trừ trách nhiệm",
    paragraphs: [
      "Nội dung, công cụ và kết quả đánh giá trên website được cung cấp nhằm mục đích tham khảo, hỗ trợ anh/chị nhìn lại tình hình tài chính, cấu trúc vốn và cách đầu tư của mình.",
      "Các kết quả không phải là cam kết lợi nhuận, bảo đảm kết quả đầu tư hoặc khuyến nghị mua/bán một chứng khoán cụ thể. Mọi quyết định đầu tư cần được anh/chị tự cân nhắc dựa trên hoàn cảnh, mục tiêu và khả năng chịu rủi ro của mình.",
      "Các con số như tỷ suất hòa vốn, mức lợi nhuận cần thiết hoặc áp lực dòng tiền được tính từ dữ liệu anh/chị cung cấp và các giả định của hệ thống. Mức yêu cầu lợi nhuận cao là tín hiệu để xem lại mục tiêu, vốn, chi phí và dòng tiền — không phải lý do để tăng mức độ rủi ro giao dịch."
    ]
  },
  privacy: {
    title: "Chính sách bảo mật",
    paragraphs: [
      "Chúng tôi chỉ thu thập những thông tin cần thiết để vận hành website, bài đánh giá và hỗ trợ anh/chị khi có nhu cầu trao đổi, ví dụ: họ tên, số điện thoại, email và dữ liệu anh/chị chủ động nhập vào bài đánh giá.",
      "Các công cụ/trò chơi có thể ghi dữ liệu hành vi ẩn danh như công cụ đã dùng, trạng thái hoàn thành, nhóm kết quả và nguồn truy cập. Nếu anh/chị sau đó chủ động gửi Assessment hoặc yêu cầu liên hệ trên cùng trình duyệt, session công cụ có thể được nối với hồ sơ để phục vụ việc hỗ trợ phù hợp hơn.",
      "Chúng tôi không bán dữ liệu cá nhân cho bên quảng cáo.",
      "Anh/chị có thể liên hệ để yêu cầu xem, điều chỉnh hoặc đề nghị xử lý/xóa dữ liệu của mình theo quy định áp dụng.",
      "Một số công cụ có thể chỉ xử lý dữ liệu tạm thời trên thiết bị và không lưu vào hệ thống nếu chức năng đó được thiết kế theo chế độ không lưu."
    ],
    bullets: [
      "thực hiện và lưu kết quả đánh giá;",
      "hiển thị lại lịch sử khi tính năng này được sử dụng;",
      "hỗ trợ liên hệ hoặc trao đổi theo yêu cầu của anh/chị;",
      "đo mức sử dụng công cụ/trò chơi và cải thiện chất lượng hệ thống."
    ]
  },
  terms: {
    title: "Điều khoản sử dụng",
    paragraphs: [
      "Khi sử dụng website, anh/chị đồng ý cung cấp thông tin trung thực trong phạm vi cần thiết để hệ thống đưa ra kết quả phù hợp.",
      "Anh/chị không được sử dụng website để gây gián đoạn hệ thống, truy cập trái phép, khai thác dữ liệu hoặc sử dụng nội dung theo cách vi phạm pháp luật.",
      "Các công cụ, nội dung, phương pháp, bố cục và tài liệu trên website thuộc quyền sở hữu của chủ thể tương ứng và không được sao chép, phân phối hoặc sử dụng cho mục đích thương mại khi chưa được cho phép.",
      "Chúng tôi có thể điều chỉnh nội dung, tính năng hoặc điều khoản để phù hợp với quá trình phát triển hệ thống và quy định pháp luật."
    ]
  },
  "assessment-data": {
    title: "Dữ liệu bài đánh giá",
    paragraphs: [
      "Bài đánh giá sử dụng thông tin anh/chị cung cấp để tính toán và trình bày kết quả cá nhân hóa.",
      "Một kết quả đã xác nhận được xem là một bản ghi tại thời điểm đánh giá. Nếu anh/chị làm lại bài đánh giá, hệ thống có thể tạo một bản đánh giá mới thay vì sửa kết quả cũ.",
      "Dữ liệu đầu vào có thể làm thay đổi đáng kể kết quả. Vì vậy, kết quả chỉ có ý nghĩa khi thông tin được nhập tương đối chính xác.",
      "Các chỉ số và kết luận được dùng để hỗ trợ nhìn lại vấn đề, không thay thế việc tự đánh giá đầy đủ hoàn cảnh tài chính và rủi ro của anh/chị."
    ]
  }
};

function initLegalFooter() {
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-open-legal]");
    if (!trigger) return;
    event.preventDefault();
    renderLegalDoc(trigger.getAttribute("data-open-legal"));
  });
}
function renderLegalDoc(key) {
  const doc = legalDocs[key];
  const title = document.querySelector("[data-legal-title]");
  const body = document.querySelector("[data-legal-body]");
  if (!doc || !title || !body) return;
  title.textContent = doc.title;
  body.replaceChildren();
  doc.paragraphs.forEach((copy, index) => {
    const paragraph = document.createElement("p");
    paragraph.textContent = copy;
    body.append(paragraph);
    if (key === "privacy" && index === 0 && doc.bullets?.length) {
      const intro = document.createElement("p");
      intro.textContent = "Thông tin được sử dụng để:";
      const list = document.createElement("ul");
      doc.bullets.forEach((item) => { const bullet = document.createElement("li"); bullet.textContent = item; list.append(bullet); });
      body.append(intro, list);
    }
  });
  openModal("legal");
}
