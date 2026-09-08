const backButtons=document.querySelectorAll('[data-smart-back]');
backButtons.forEach(btn=>btn.addEventListener('click',()=>{
  const sameSite=document.referrer&&new URL(document.referrer).origin===window.location.origin;
  if(sameSite&&window.history.length>1){window.history.back();return;}
  window.location.href='./';
}));
