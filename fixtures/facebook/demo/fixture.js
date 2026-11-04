// Native fixture owns sending; content.js never reads or sends these messages.
const form = document.querySelector('form'), draft = document.querySelector('#draft');
const log = document.querySelector('[role=log]'), nav = document.querySelector('nav');
form.addEventListener('submit', event => {
  event.preventDefault(); if (!draft.value.trim()) return;
  const article = document.createElement('article'); article.className = 'mine';
  const b = document.createElement('b'); b.textContent = 'Bạn';
  const p = document.createElement('p'); p.textContent = draft.value;
  article.append(b,p); log.append(article); draft.value = ''; log.scrollTop = log.scrollHeight;
});
nav.addEventListener('click', event => { if(event.target.closest('a')) event.preventDefault(); });
document.querySelector('#switch').onclick = () => {
  document.querySelector('#peer').textContent = document.querySelector('#peer').textContent === 'Alice' ? 'Bob' : 'Alice';
};
document.querySelector('#unknown').onclick = () => { nav.hidden = !nav.hidden; yahooRetroFixture.refresh(); };
document.querySelector('#skin').onclick = () => yahooRetroFixture.setEnabled(yahooRetroFixture.state() === 'off');
document.querySelector('#test').onclick = async () => {
  const out = document.querySelector('#results'), results = [];
  const check = (condition, label) => { results.push(`${condition ? 'PASS' : 'FAIL'} ${label}`); if (!condition) throw Error(label); };
  try {
    nav.hidden = false; await yahooRetroFixture.setEnabled(true);
    check(yahooRetroFixture.state() === 'active', 'Nhận diện fixture');
    check(document.querySelector('[data-yfr-role="composer"]') === draft, 'Giữ nguyên node soạn');
    draft.value = 'Bản nháp tiếng Việt 🎵'; draft.focus(); draft.setSelectionRange(5, 8);
    await yahooRetroFixture.setEnabled(false);
    check(!document.documentElement.hasAttribute('data-yfr-active') && !document.querySelector('[data-yfr-role]'), 'Tắt khôi phục toàn bộ dấu đánh dấu');
    check(draft.value === 'Bản nháp tiếng Việt 🎵' && document.activeElement === draft && draft.selectionStart === 5, 'Giữ nháp, focus, con trỏ');
    await yahooRetroFixture.setEnabled(true);
    const before = log.children.length; form.requestSubmit();
    check(log.children.length === before + 1 && draft.value === '', 'Gửi demo đúng một lần qua handler gốc');
    nav.hidden = true; yahooRetroFixture.refresh();
    check(yahooRetroFixture.state() === 'unrecognized' && !document.documentElement.hasAttribute('data-yfr-active'), 'Bố cục lạ giữ trang gốc');
    nav.hidden = false;
    const second = document.createElement('main'); second.textContent = 'Ambiguous'; document.body.append(second); yahooRetroFixture.refresh();
    check(yahooRetroFixture.state() === 'unrecognized', 'Nhiều main không áp skin nhầm'); second.remove();
    yahooRetroFixture.refresh(); check(yahooRetroFixture.state() === 'active', 'Phục hồi khi DOM thay đổi');
    document.querySelector('#switch').click(); yahooRetroFixture.refresh();
    check(document.querySelector('#peer').textContent === 'Bob' && document.querySelector('#draft') === draft, 'Đổi hội thoại giữ node gốc');
    results.push('9/9 kiểm thử fixture đạt. Facebook thật chưa xác minh.');
  } catch(error) { results.push(`LỖI: ${error.message}`); }
  out.textContent = results.join(' · ');
};
