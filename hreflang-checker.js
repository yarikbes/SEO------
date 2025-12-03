(function(){
  var dataUrl='https://yarikbes.github.io/SEO------/slugs.json';
  var hreflangCodes=['x-default','sv-SE','sv','nl-NL','nl-BE','nl','de-DE','de','fr-FR','fr-BE','fr','es-ES','es','it-IT','it','pl-PL','pl','fi-FI','fi','da-DK','da','nb-NO','nb','pt-PT','pt','cs-CZ','cs','ro-RO','ro','sl-SI','sl','el-GR','el','et-EE','et','hu-HU','hu','en-GB','en-NZ','en-CA','en-AU','en-US','en-IE','ga-IE','en','es-AR','es-MX','fr-CA','fr-CH','pt-BR','de-AT','de-CH','it-CH'];
  var reloadCookie='showCloak';
  var widgetClass='hreflang-checker-widget';
  var emptyClass='hreflang-empty-widget';

  function stripLangPrefix(path){return path.replace(/^\/(?:[a-z]{2}(?:-[A-Z]{2})?)\//,'/');}
  function cleanPath(path){return path.replace(/\/+/g,'/').replace(/\/$/,'');}
  function normalizePath(path){var cleaned=cleanPath(path);return cleaned||'/';}
  function normalizeUrl(raw){var parsed=new URL(raw,location.origin);return parsed.origin+normalizePath(parsed.pathname);}
  function formatMessages(text){return text?text.split('; ').filter(Boolean):[];}
  function setStyles(el,css){Object.keys(css).forEach(function(key){el.style[key]=css[key];});}
  function create(tag,css){var el=document.createElement(tag);if(css)setStyles(el,css);return el;}
  function createList(label,color,messages){var wrap=create('div',{padding:'4px 0'});var badge=create('span',{color:color,fontWeight:'bold',display:'inline-block',marginBottom:messages.length?'4px':'0'});badge.textContent=label;wrap.appendChild(badge);messages.forEach(function(msg){var line=create('div',{color:'#000',fontSize:'11px'});line.textContent='- '+msg;wrap.appendChild(line);});return wrap;}
  function attachCloseHandler(btn,widget){btn.addEventListener('click',function(ev){ev.preventDefault();ev.stopPropagation();widget.remove();},true);}
  function ensureAlias(map,key,value){map[key]=value;if(key.charAt(0)!=='/'){map['/'+key]=value;}}
  function hasDoubleSlash(url){var remainder=url.replace(/^https?:\/\/[^\/]+/i,'');return remainder.indexOf('//')>-1;}
  function removeExistingWidgets(){var nodes=document.querySelectorAll('.'+widgetClass+',.'+emptyClass);nodes.forEach(function(node){node.remove();});}

  function showEmptyWidget(){var emptyWidget=create('div');emptyWidget.className=emptyClass;emptyWidget.style.cssText='position:fixed!important;top:20px!important;left:20px!important;background:#fff!important;border:1px solid #ccc!important;box-shadow:0 2px 10px rgba(0,0,0,0.2)!important;z-index:2147483647!important;max-width:500px!important;font-family:Arial,sans-serif!important;font-size:14px!important;border-radius:8px!important';emptyWidget.innerHTML='<div style="background:#fff3cd!important;padding:16px!important;border-bottom:1px solid #ccc!important;display:flex!important;justify-content:space-between!important;align-items:center!important;min-height:40px!important"><span style="font-weight:bold!important;color:#856404!important;flex:1!important">Hreflang не найдены</span><button class="hreflang-close-btn" style="background:none!important;border:none!important;font-size:24px!important;line-height:1!important;padding:0!important;margin:0!important;width:24px!important;height:24px!important;min-width:24px!important;min-height:24px!important;flex-shrink:0!important;cursor:pointer!important;color:#856404!important;font-weight:bold!important;display:flex!important;align-items:center!important;justify-content:center!important">X</button></div><div style="padding:20px!important"><p style="margin:0 0 12px 0!important;color:#000!important">На этой странице не найдены теги <code style="background:#f5f5f5!important;padding:2px 6px!important;border-radius:3px!important;color:#000!important">&lt;link rel="alternate" hreflang="..."&gt;</code></p><p style="margin:0!important;color:#333!important;font-size:13px!important"><strong>Возможные причины:</strong><br>&bull; Страница не мультиязычная<br>&bull; Теги скрыты JavaScript (клоакинг)<br>&bull; Теги еще не загружены</p></div>';
    document.body.appendChild(emptyWidget);
    var btn=emptyWidget.querySelector('.hreflang-close-btn');
    if(btn){btn.addEventListener('click',function(ev){ev.preventDefault();ev.stopPropagation();emptyWidget.remove();},true);} }

  function runChecker(){removeExistingWidgets();fetch(dataUrl).then(function(r){return r.json();}).then(function(payload){var pageGroups=payload.pageGroups;var slugMap={};var aliasMap={};Object.keys(pageGroups).forEach(function(groupKey){var group=pageGroups[groupKey];Object.keys(group.slugs).forEach(function(slug){slugMap[slug]=groupKey;});aliasMap[groupKey]=groupKey;if(Array.isArray(group.aliases)){group.aliases.forEach(function(alias){ensureAlias(aliasMap,alias,groupKey);});}});var alternates=document.querySelectorAll('link[rel="alternate"][hreflang]');var canonical=document.querySelector('link[rel="canonical"]');var canonicalUrl=canonical?canonical.getAttribute('href'):'';var currentPath=cleanPath(location.pathname);var normalizedCurrent=location.origin+normalizePath(location.pathname);var strippedPath=stripLangPrefix(currentPath);var currentGroup=slugMap[strippedPath]||slugMap[strippedPath+'/']||slugMap[strippedPath.replace(/\/$/,'')]||aliasMap[strippedPath]||aliasMap[strippedPath.replace(/^\//,'')];var errors=[];var rows=[];var warnings=[];if(alternates.length===0){if(!document.cookie.split(';').some(function(c){return c.trim().indexOf(reloadCookie+'=')===0;})){document.cookie=reloadCookie+'=1; path=/';location.reload();return;}showEmptyWidget();return;}alternates.forEach(function(link){var rawHref=link.getAttribute('href');var hreflang=link.getAttribute('hreflang');var url=new URL(rawHref,location.origin);var cleanedPath=cleanPath(url.pathname);var stripped=stripLangPrefix(cleanedPath);var group=slugMap[stripped]||slugMap[stripped+'/']||slugMap[stripped.replace(/\/$/,'')]||aliasMap[stripped]||aliasMap[stripped.replace(/^\//,'')];var isCurrent=normalizeUrl(rawHref)===normalizedCurrent;var entryErrors=[];var entryWarnings=[];var hasError=false;if(hreflang!==hreflang.trim()){hasError=true;entryErrors.push('Пробелы в hreflang: "'+hreflang+'"');}
      if(!hreflangCodes.includes(hreflang)){hasError=true;entryErrors.push('Неправильный код hreflang: "'+hreflang+'"');}
      if(/^https?[:/][^/]/.test(rawHref)){hasError=true;entryErrors.push('Неправильный протокол в URL');}
      if(!group){hasError=true;entryErrors.push('URL не найден в базе слагов');}
      else if(currentGroup&&group!==currentGroup){hasError=true;entryErrors.push('Неправильная группа: '+group+' вместо '+currentGroup);}
      var isHome=url.pathname==='/'||url.pathname==='';
      if(canonicalUrl&&isCurrent){var canonicalHref=link.getAttribute('href');if(canonicalHref!==canonicalUrl){entryWarnings.push('Не совпадает с canonical');warnings.push({href:rawHref,hreflang:hreflang,msg:'Не совпадает с canonical: '+canonicalUrl});}}
      if(rawHref.indexOf('_')>-1){entryWarnings.push('Нижнее подчёркивание в URL');}
      if(/[A-Z]/.test(rawHref)){entryWarnings.push('Заглавные буквы в URL');}
      if(rawHref.indexOf('%20')>-1){entryWarnings.push('Пробелы (%20) в URL');}
      if(hasDoubleSlash(rawHref)){entryWarnings.push('Двойные слэши в URL');}
      if(/[^a-z0-9\-._~:/?#[\]@!$&'()*+,;=%]/.test(rawHref.toLowerCase())){entryWarnings.push('Недопустимые символы в URL');}
      var slashPattern=null;
      if(!isHome){var hasSlash=rawHref.endsWith('/');slashPattern=hasSlash?'with':'without';rows.forEach(function(prev){if(prev.slashPattern&&prev.slashPattern!==slashPattern){entryWarnings.push('Несогласованный trailing slash');}});if(!rows.slashPattern){rows.slashPattern=slashPattern;}}
      var row={href:rawHref,hreflang:hreflang,group:group,err:hasError,msg:entryErrors.join('; '),warn:entryWarnings.length>0,warnMsg:entryWarnings.join('; '),cur:isCurrent,slashPattern:slashPattern};
      rows.push(row);
      if(hasError){errors.push({href:rawHref,hreflang:hreflang,group:group,msg:row.msg});}
      if(entryWarnings.length>0){warnings.push({href:rawHref,hreflang:hreflang,msg:row.warnMsg});}
    });
    var widget=create('div');widget.className=widgetClass;widget.style.cssText='position:fixed!important;top:20px!important;left:20px!important;background:#fff!important;border:1px solid #ccc!important;box-shadow:0 2px 10px rgba(0,0,0,0.2)!important;z-index:2147483647!important;max-width:1200px!important;max-height:80vh!important;overflow:auto!important;font-family:Arial,sans-serif!important;font-size:13px!important;border-radius:8px!important';
    var headerBg=errors.length>0?'#ffebee':warnings.length>0?'#fff3cd':'#e8f5e9';
    var headerColor=errors.length>0?'#c62828':warnings.length>0?'#856404':'#2e7d32';
    var header=create('div',{backgroundColor:headerBg,padding:'6px 12px',borderBottom:'1px solid #ccc',display:'flex',justifyContent:'space-between',alignItems:'center',position:'sticky',top:'0',minHeight:'32px'});
    var headerTitle=create('span',{fontWeight:'bold',color:headerColor,flex:'1'});
    headerTitle.textContent='Hreflang Check: '+(errors.length>0?errors.length+' ошибок':warnings.length>0?warnings.length+' предупреждений':'Всё ОК');
    var closeBtn=create('button',{background:'none',border:'none',cursor:'pointer',fontSize:'24px',lineHeight:'1',padding:'0',margin:'0',width:'24px',height:'24px',minWidth:'24px',minHeight:'24px',flexShrink:'0',color:headerColor,fontWeight:'bold',display:'flex',alignItems:'center',justifyContent:'center'});
    closeBtn.textContent='X';
    attachCloseHandler(closeBtn,widget);
    header.appendChild(headerTitle);
    header.appendChild(closeBtn);
    widget.appendChild(header);
    var currentInfo=create('div',{padding:'4px 12px',background:'#f5f5f5',borderBottom:'1px solid #e0e0e0',position:'sticky',top:'32px',color:'#000'});
    var infoLabel=create('strong',{color:'#000'});infoLabel.textContent='Текущая страница: ';
    currentInfo.appendChild(infoLabel);
    var pathSpan=create('span',{color:'#000'});pathSpan.textContent=currentPath||'/';currentInfo.appendChild(pathSpan);
    var groupSpan=create('span',{color:'#555',marginLeft:'6px'});groupSpan.textContent='('+(currentGroup||'группа не найдена')+')';currentInfo.appendChild(groupSpan);
    widget.appendChild(currentInfo);
    var table=create('table');table.style.cssText='width:100%!important;border-collapse:collapse!important;table-layout:auto!important';
    var thead=create('thead');
    var headerRow=create('tr');headerRow.style.cssText='background:#e8f0fe!important;position:sticky!important;top:56px!important';
    ['URL','hreflang','Статус'].forEach(function(label,idx){var th=create('th',{padding:'4px 12px',textAlign:'left',color:'#000',fontWeight:'bold',whiteSpace:idx===1?'nowrap':'normal'});th.textContent=label;headerRow.appendChild(th);});
    thead.appendChild(headerRow);table.appendChild(thead);
    var tbody=document.createElement('tbody');
    rows.forEach(function(entry,index){var bg=entry.cur?'#d4edda':entry.err?'#ffebee':entry.warn?'#fff3cd':(index%2?'#f9f9f9':'#fff');
      var tr=create('tr',{backgroundColor:bg});
      var urlCell=create('td',{padding:'4px 12px',fontSize:'11px',whiteSpace:'nowrap'});
      var linkEl=create('a',{color:entry.err?'#c62828':entry.warn?'#856404':'#1558d6',textDecoration:'none'});
      linkEl.textContent=entry.href;
      linkEl.href=entry.href;
      linkEl.target='_blank';
      linkEl.rel='noreferrer noopener';
      urlCell.appendChild(linkEl);
      tr.appendChild(urlCell);
      var hlCell=create('td',{padding:'4px 12px',fontWeight:'bold',color:'#333',whiteSpace:'nowrap'});
      hlCell.textContent=entry.hreflang;
      tr.appendChild(hlCell);
      var statusCell=create('td',{padding:'4px 12px',fontSize:'11px'});
      if(entry.err){statusCell.appendChild(createList('[ERR] Ошибка', '#c62828', formatMessages(entry.msg)));}
      else if(entry.warn){statusCell.appendChild(createList('[WARN] Предупреждение', '#856404', formatMessages(entry.warnMsg)));}
      else{var ok=create('span',{color:'#2e7d32'});ok.textContent='OK ('+(entry.group||'')+')';statusCell.appendChild(ok);}
      tr.appendChild(statusCell);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    widget.appendChild(table);
    var footer=create('div',{padding:'8px 12px',background:'#f5f5f5',borderTop:'1px solid #ccc',color:'#000'});
    footer.textContent='Всего: '+alternates.length+' | Ошибок: '+errors.length+' | Предупреждений: '+warnings.length;
    widget.appendChild(footer);
    document.body.appendChild(widget);
  }).catch(function(err){alert('Ошибка загрузки базы слагов: '+err.message);});}

  function start(){setTimeout(runChecker,500);}

  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',start);}else{start();}
})();
