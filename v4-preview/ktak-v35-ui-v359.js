(() => {
'use strict';
window.__KTAK35_V359={version:'3.5.9',teamLabelMode:'same-svg-above-path',portraitDrawer:'compact-left'};

const isV4Preview=()=>location.pathname.endsWith('/v4-preview/')||location.pathname.endsWith('/v4-preview/index.html');
const loadRefine=()=>{
  if(!isV4Preview()||document.getElementById('ktak-v4-alpha5-refine'))return;
  const style=document.createElement('link');
  style.id='ktak-v4-alpha5-style';
  style.rel='stylesheet';
  style.href='./ktak-v4-alpha5.css?v=20260911a';
  document.head.append(style);
  const script=document.createElement('script');
  script.id='ktak-v4-alpha5-refine';
  script.src='./ktak-v4-alpha5.js?v=20260911a';
  script.defer=true;
  document.body.append(script);
};
if(document.readyState==='complete')setTimeout(loadRefine,60);
else window.addEventListener('load',()=>setTimeout(loadRefine,60),{once:true});
})();
