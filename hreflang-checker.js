(function(){
  var dataUrl='https://yarikbes.github.io/SEO------/slugs.json';
  var telemetryUrl='https://hreflang-checker.dorian-grei33.workers.dev/ping';
  var hreflangCodes=['x-default','sv-SE','sv','nl-NL','nl-BE','nl','de-DE','de','fr-FR','fr-BE','fr','es-ES','es','it-IT','it','pl-PL','pl','fi-FI','fi','da-DK','da','nb-NO','nb','no-NO','no','pt-PT','pt','cs-CZ','cs','ro-RO','ro','sl-SI','sl','el-GR','el','et-EE','et','hu-HU','hu','en-GB','en-NZ','en-CA','en-AU','en-US','en-IE','ga-IE','en','es-AR','es-MX','fr-CA','fr-CH','pt-BR','de-AT','de-CH','it-CH','ja','ja-JP','hi-IN','en-IN','fil-PH','en-PH','ar-AE','en-AE','in','sh'];
    var specialHreflangHints={
      'in':'Устаревший код, используйте id (например id-ID)',
      'sh':'Устаревший код, используйте sr/hr/bs с регионом'
    };
  var slugAliasMap={'no':'nb','cz':'cs','gr':'el','se':'sv','dk':'da','jp':'ja','cn':'zh','ua':'uk','in':'id','iw':'he'};
  var hreflangCanonicalMap={'no':'nb-NO','no-no':'nb-NO'};
  var reloadCookie='showCloak';
  var widgetClass='hreflang-checker-widget';
  var emptyClass='hreflang-empty-widget';

  function stripLangPrefix(path){return path.replace(/^\/(?:[a-z]{2}(?:-[A-Z]{2})?)\//,'/');}
  function cleanPath(path){var cleaned=path.replace(/\/+/g,'/').replace(/\/$/,'');return cleaned||'/';}
  function normalizePath(path){if(!path)return'/';var normalized=path.replace(/\/+/g,'/');if(normalized.charAt(0)!=='/'){normalized='/'+normalized;}return normalized||'/';}
  function normalizeUrl(raw){var parsed=new URL(raw,location.origin);return parsed.origin+normalizePath(parsed.pathname);}
  function formatMessages(text){return text?text.split('; ').filter(Boolean):[];}
  function normalizeCodes(entry){if(!entry)return[];if(Array.isArray(entry))return entry.filter(Boolean);if(typeof entry==='object'&&Array.isArray(entry.codes))return entry.codes.filter(Boolean);return[];}
  function addCodeMapping(codeIndex,code,groupKey,slug){var normalizedCode=code.toLowerCase();var primary=normalizedCode.split('-')[0];[normalizedCode,primary].forEach(function(key){var entry=codeIndex[key]||{display:code,defaultSlug:null,groups:{}};if(!entry.defaultSlug){entry.defaultSlug=slug;}if(!entry.groups[groupKey]){entry.groups[groupKey]=slug;}codeIndex[key]=entry;});}
  function buildSlugIndex(pageGroups){var slugIndex={};var codeIndex={};Object.keys(pageGroups).forEach(function(rawGroup){var groupKey=/^[a-z]{2}(?:-[a-z]{2})?$/i.test(rawGroup)?'main':rawGroup;var group=pageGroups[rawGroup];Object.keys(group.slugs).forEach(function(slug){var normalizedSlug=slug||'';if(normalizedSlug&&normalizedSlug.charAt(0)!=='/'){normalizedSlug='/'+normalizedSlug;}var codes=normalizeCodes(group.slugs[slug]);var uniqueCodes=[];codes.forEach(function(code){var trimmed=code.trim();if(trimmed&&uniqueCodes.indexOf(trimmed)===-1){uniqueCodes.push(trimmed);}addCodeMapping(codeIndex,trimmed,groupKey,normalizedSlug);});slugIndex[normalizedSlug]={group:groupKey,codes:uniqueCodes};});});return {slugIndex:slugIndex,codeIndex:codeIndex};}
  function matchSlug(index,path){if(!path)return null;var candidates=[];var base=path.charAt(0)==='/'?path:'/'+path;candidates.push(base);if(base.slice(-1)!=='/'){candidates.push(base+'/');}else{candidates.push(base.slice(0,-1));}candidates.push(base.replace(/\/+/g,'/'));for(var i=0;i<candidates.length;i+=1){var candidate=candidates[i];if(!candidate)continue;var match=index[candidate];if(match){return {slug:candidate,group:match.group,codes:match.codes};}}return null;}
    function rewriteSlugByAlias(path,aliasMap){var parts=path.split('/');for(var i=0;i<parts.length;i+=1){if(parts[i]){var lower=parts[i].toLowerCase();if(aliasMap[lower]){parts[i]=aliasMap[lower];return {path:parts.join('/'),from:lower,to:aliasMap[lower]};}break;}}return null;}
    function matchSlugWithAliases(index,path,aliasMap){var direct=matchSlug(index,path);if(direct)return {slug:direct.slug,group:direct.group,codes:direct.codes,aliasUsed:false};var rewrite=rewriteSlugByAlias(path,aliasMap);if(rewrite){var via=matchSlug(index,rewrite.path);if(via){return {slug:via.slug,group:via.group,codes:via.codes,aliasUsed:true,aliasFrom:rewrite.from,aliasTo:rewrite.to,aliasPath:rewrite.path};}}return null;}
  function codesMatch(expected,actual){if(!expected||expected.length===0)return true;var value=(actual||'').trim().toLowerCase();if(!value)return false;var valuePrimary=value.split('-')[0];return expected.some(function(code){var c=code.toLowerCase();if(c===value)return true;var cPrimary=c.split('-')[0];return cPrimary===valuePrimary;});}
  function setStyles(el,css){Object.keys(css).forEach(function(key){el.style[key]=css[key];});}
  function create(tag,css){var el=document.createElement(tag);if(css)setStyles(el,css);return el;}
  function createList(label,color,messages){var wrap=create('div',{padding:'4px 0'});var badge=create('span',{color:color,fontWeight:'bold',display:'inline-block',marginBottom:messages.length?'4px':'0'});badge.textContent=label;wrap.appendChild(badge);messages.forEach(function(msg){if(/^Фактический href:/i.test(msg)){return;}var line=create('div',{color:'#000',fontSize:'11px'});line.textContent='- '+msg;wrap.appendChild(line);});return wrap;}
  function attachCloseHandler(btn,widget){btn.addEventListener('click',function(ev){ev.preventDefault();ev.stopPropagation();widget.remove();},true);}
  function ensureAlias(map,key,value){map[key]=value;if(key.charAt(0)!=='/'){map['/'+key]=value;}}
  function hasDoubleSlash(url){var remainder=url.replace(/^https?:\/\/[^\/]+/i,'');return remainder.indexOf('//')>-1;}
  function isHomeTrailingSlashOnlyHrefMismatch(rawHref,parsedUrl){
    if(!rawHref||!parsedUrl)return false;
    if(rawHref.indexOf('#')>-1)return false;
    if(!(parsedUrl.pathname==='/'||parsedUrl.pathname===''))return false;
    // Считаем предупреждением только случаи:
    // - https://site.tld (без "/")
    // - https://site.tld?x=1 (без "/" перед query)
    // Все остальные несовпадения оставляем ошибками.
    var origin=parsedUrl.origin;
    var search=parsedUrl.search||'';
    return rawHref===origin || (search && rawHref===origin+search);
  }
  function removeExistingWidgets(){var nodes=document.querySelectorAll('.'+widgetClass+',.'+emptyClass);nodes.forEach(function(node){node.remove();});}

  function uuid(){return'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0,v=c==='x'?r:(r&0x3|0x8);return v.toString(16);});}
  function getInstallInfo(){var fallback={id:'anon',isNew:false};try{var key='hreflang_checker_install_id';var saved=localStorage.getItem(key);if(saved){return {id:saved,isNew:false};}var id=uuid();localStorage.setItem(key,id);return {id:id,isNew:true};}catch(e){return fallback;}}
  function sendTelemetry(event,force){try{if(!telemetryUrl)return;var info=getInstallInfo();if(event==='install'&&!force&&!info.isNew){return;}var id=info.id;var version='1.0.0';var url=telemetryUrl+'?event='+encodeURIComponent(event)+'&version='+encodeURIComponent(version)+'&id='+encodeURIComponent(id);fetch(url,{method:'GET',mode:'no-cors',cache:'no-store',keepalive:true});}catch(e){}}
  function buildClipboardText(rows,errors,warnings){var lines=[];lines.push('Всего: '+rows.length+' | Ошибок: '+errors.length+' | Предупреждений: '+warnings.length);rows.forEach(function(row){var parts=[];if(row.err&&row.msg){parts.push('ERR: '+row.msg);}if(row.warn&&row.warnMsg){parts.push('WARN: '+row.warnMsg);}var status=parts.length?parts.join(' | '):'OK';lines.push((row.hreflang||'')+'\t'+row.href+'\t'+status);});return lines.join('\n');}

  function showEmptyWidget(){var emptyWidget=create('div');emptyWidget.className=emptyClass;emptyWidget.style.cssText='position:fixed!important;top:20px!important;left:20px!important;background:#fff!important;border:1px solid #ccc!important;box-shadow:0 2px 10px rgba(0,0,0,0.2)!important;z-index:2147483647!important;max-width:500px!important;font-family:Arial,sans-serif!important;font-size:14px!important;border-radius:8px!important';emptyWidget.innerHTML='<div style="background:#fff3cd!important;padding:16px!important;border-bottom:1px solid #ccc!important;display:flex!important;justify-content:space-between!important;align-items:center!important;min-height:40px!important"><span style="font-weight:bold!important;color:#856404!important;flex:1!important">Hreflang не найдены</span><button class="hreflang-close-btn" style="background:none!important;border:none!important;font-size:24px!important;line-height:1!important;padding:0!important;margin:0!important;width:24px!important;height:24px!important;min-width:24px!important;min-height:24px!important;flex-shrink:0!important;cursor:pointer!important;color:#856404!important;font-weight:bold!important;display:flex!important;align-items:center!important;justify-content:center!important">X</button></div><div style="padding:20px!important"><p style="margin:0 0 12px 0!important;color:#000!important">На этой странице не найдены теги <code style="background:#f5f5f5!important;padding:2px 6px!important;border-radius:3px!important;color:#000!important">&lt;link rel="alternate" hreflang="..."&gt;</code></p><p style="margin:0!important;color:#333!important;font-size:13px!important"><strong>Возможные причины:</strong><br>&bull; Страница не мультиязычная<br>&bull; Теги скрыты JavaScript (клоакинг)<br>&bull; Теги еще не загружены</p></div>';
    document.body.appendChild(emptyWidget);
    var btn=emptyWidget.querySelector('.hreflang-close-btn');
    if(btn){btn.addEventListener('click',function(ev){ev.preventDefault();ev.stopPropagation();emptyWidget.remove();},true);} }

  function finalizeAnalysis(rows,warnings,codeCount,hrefCount,hostIssues,baseHost,normalizedCurrent){
    // Пост-обработка: дубликаты, домены, self-ref
    var hasSelf=rows.some(function(r){return r.cur;});
    rows.forEach(function(row){
      var errs=row.msg?row.msg.split('; ').filter(Boolean):[];
      var warns=row.warnMsg?row.warnMsg.split('; ').filter(Boolean):[];
      if(codeCount[row.hreflang]>1){errs.push('Дублируется hreflang '+row.hreflang+' ('+codeCount[row.hreflang]+' шт.)');}
      if(hrefCount[row.normalizedHref]>1){errs.push('Один URL использован для нескольких hreflang: '+row.normalizedHref);}
      if(hostIssues[row.normalizedHref]==='error'){errs.push('Другой домен в hreflang: '+row.hrefHost+' вместо '+baseHost);}
      else if(hostIssues[row.normalizedHref]==='warn'){warns.push('Поддомен отличается от текущего: '+row.hrefHost);}
      row.msg=errs.join('; ');
      row.warnMsg=warns.join('; ');
      row.err=errs.length>0;
      row.warn=warns.length>0;
    });
    var warningsOut=Array.isArray(warnings)?warnings.slice():[];
    if(!hasSelf){warningsOut.push({href:normalizedCurrent,hreflang:'',msg:'Нет self-referencing hreflang для текущей страницы'});}

    var errorsOut=[];
    rows.forEach(function(row){
      if(row.err){errorsOut.push({href:row.href,hreflang:row.hreflang,group:row.group,msg:row.msg});}
      if(row.warn){warningsOut.push({href:row.href,hreflang:row.hreflang,msg:row.warnMsg});}
    });

    return {rows:rows,errors:errorsOut,warnings:warningsOut,hasSelf:hasSelf};
  }

  function renderWidget(report){
    var rows=report.rows||[];
    var errors=report.errors||[];
    var warnings=report.warnings||[];
    var currentPath=report.currentPath||'';
    var currentGroup=report.currentGroup||'';
    var totalAlternates=Number.isFinite(report.totalAlternates)?report.totalAlternates:rows.length;

    var widget=create('div');
    widget.className=widgetClass;
    widget.style.cssText='position:fixed!important;top:20px!important;left:20px!important;background:#fff!important;border:1px solid #ccc!important;box-shadow:0 2px 10px rgba(0,0,0,0.2)!important;z-index:2147483647!important;max-width:1200px!important;max-height:80vh!important;overflow:auto!important;font-family:Arial,sans-serif!important;font-size:13px!important;border-radius:8px!important';

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

    var table=create('table');
    table.style.cssText='width:100%!important;border-collapse:collapse!important;table-layout:auto!important';
    var thead=create('thead');
    var headerRow=create('tr');
    headerRow.style.cssText='background:#e8f0fe!important;position:sticky!important;top:56px!important';
    ['URL','hreflang','Статус'].forEach(function(label,idx){
      var th=create('th',{padding:'4px 12px',textAlign:'left',color:'#000',fontWeight:'bold',whiteSpace:idx===1?'nowrap':'normal'});
      th.textContent=label;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    var tbody=document.createElement('tbody');
    rows.forEach(function(entry,index){
      var bg=entry.cur?'#d4edda':entry.err?'#ffebee':entry.warn?'#fff3cd':(index%2?'#f9f9f9':'#fff');
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
      var hasContent=false;
      if((entry.err||entry.warn)&&entry.href!==entry.normalizedHref){
        var parsedTop=create('div',{color:entry.err?'#c62828':'#856404',fontWeight:'bold',marginBottom:'2px'});
        parsedTop.textContent='Фактический href: '+entry.normalizedHref;
        statusCell.appendChild(parsedTop);
        hasContent=true;
      }
      if(entry.err){statusCell.appendChild(createList('[ERR] Ошибка', '#c62828', formatMessages(entry.msg)));hasContent=true;}
      if(entry.warn){statusCell.appendChild(createList('[WARN] Предупреждение', '#856404', formatMessages(entry.warnMsg)));hasContent=true;}
      if(!hasContent){var ok=create('span',{color:'#2e7d32'});ok.textContent='OK ('+(entry.group||'')+')';statusCell.appendChild(ok);}
      tr.appendChild(statusCell);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    widget.appendChild(table);

    var footer=create('div',{padding:'8px 12px',background:'#f5f5f5',borderTop:'1px solid #ccc',color:'#000',position:'sticky',bottom:'0',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'12px'});
    var footerText=create('span',{color:'#000'});
    footerText.textContent='Всего: '+totalAlternates+' | Ошибок: '+errors.length+' | Предупреждений: '+warnings.length;
    footer.appendChild(footerText);
    var copyBtn=create('button',{background:'#1558d6',color:'#fff',border:'none',padding:'6px 10px',borderRadius:'4px',cursor:'pointer',fontWeight:'bold'});
    copyBtn.textContent='Скопировать результат';
    copyBtn.addEventListener('click',function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      var text=buildClipboardText(rows,errors,warnings);
      if(navigator.clipboard&&navigator.clipboard.writeText){
        navigator.clipboard.writeText(text).catch(function(err){alert('Не удалось скопировать: '+err.message);});
      }else{
        alert('Копирование не поддерживается в этом браузере');
      }
    });
    footer.appendChild(copyBtn);
    widget.appendChild(footer);
    document.body.appendChild(widget);
  }

  function analyzeAlternates(alternates,context){
    var slugIndex=context.slugIndex;
    var codeIndex=context.codeIndex;
    var aliasMap=context.aliasMap;
    var currentGroup=context.currentGroup;
    var normalizedCurrent=context.normalizedCurrent;
    var canonicalUrl=context.canonicalUrl;
    var baseHost=context.baseHost;
    var origin=context.origin;

    var rows=[];
    var warnings=[];
    var codeCount={};
    var hrefCount={};
    var hostIssues={};

    alternates.forEach(function(link){
      var rawHref=link.getAttribute('href');
      var hreflang=link.getAttribute('hreflang');
      var hreflangForMatch=hreflang;
      var url=new URL(rawHref,origin);
      var cleanedPath=cleanPath(url.pathname);
      var stripped=stripLangPrefix(cleanedPath);
      var match=matchSlugWithAliases(slugIndex,cleanedPath,slugAliasMap)||matchSlugWithAliases(slugIndex,stripped,slugAliasMap);
      var matchAliasUsed=match&&match.aliasUsed;
      var aliasFrom=match&&match.aliasFrom;
      var aliasTo=match&&match.aliasTo;
      var group=match?match.group:aliasMap[cleanedPath]||aliasMap[stripped]||aliasMap[stripped.replace(/^\//,'')];
      var isCurrent=normalizeUrl(rawHref)===normalizedCurrent;
      var entryErrors=[];
      var entryWarnings=[];
      var hasError=false;

      if(hreflang!==hreflang.trim()){
        hasError=true;
        entryErrors.push('Пробелы в hreflang: "'+hreflang+'"');
        hreflangForMatch=hreflang.trim();
      }
      if(!hreflangCodes.includes(hreflangForMatch)){
        hasError=true;
        entryErrors.push('Неправильный код hreflang: "'+hreflang+'"');
      }
      else{
        var lowerHreflang=String(hreflangForMatch||'').toLowerCase();
        var canonical=hreflangCanonicalMap[lowerHreflang];
        if(canonical){
          hasError=true;
          entryErrors.push('Нерекомендуемый hreflang: "'+hreflang+'" — используйте '+canonical);
          hreflangForMatch=canonical;
        }
        var hasSpecialHint=Boolean(specialHreflangHints[lowerHreflang]);
        if(hasSpecialHint){entryWarnings.push(specialHreflangHints[lowerHreflang]);}
        else if(/^[a-z]{2}$/i.test(hreflangForMatch)&&lowerHreflang!=='x-default'){entryWarnings.push('Рекомендуется указать регион (например '+hreflangForMatch+'-XX)');}
      }
      if(/^https?[:/][^/]/.test(rawHref)){hasError=true;entryErrors.push('Неправильный протокол в URL');}
      if(!group){hasError=true;entryErrors.push('URL не найден в базе слагов');}
      else if(matchAliasUsed){entryWarnings.push('Slug использует /'+aliasFrom+'; рекомендуется /'+aliasTo);}
      else if(currentGroup&&group!==currentGroup){hasError=true;entryErrors.push('Неправильная группа: '+group+' вместо '+currentGroup);} 

      if(!matchAliasUsed&&match&&match.codes&&match.codes.length&&!codesMatch(match.codes,hreflangForMatch)){
        hasError=true;
        var normalizedCode=(hreflangForMatch||'').trim().toLowerCase();
        var codePrimary=normalizedCode.split('-')[0];
        var expectedEntry=codeIndex[normalizedCode]||codeIndex[codePrimary];
        var expectedSlug=null;
        if(expectedEntry){
          if(currentGroup&&expectedEntry.groups[currentGroup]){expectedSlug=expectedEntry.groups[currentGroup];}
          else{expectedSlug=expectedEntry.defaultSlug;}
        }
        var expectedText=expectedSlug||'slug для этого языка не найден в базе';
        entryErrors.push('Неверный hreflang для '+hreflang+': ожидаемый slug — '+expectedText);
      }

      var isHome=url.pathname==='/'||url.pathname==='';
      if(canonicalUrl&&isCurrent){
        var canonicalHref=link.getAttribute('href');
        if(canonicalHref!==canonicalUrl){entryWarnings.push('Не совпадает с canonical');}
      }
      if(rawHref.indexOf('_')>-1){entryWarnings.push('Нижнее подчёркивание в URL');}
      if(/[A-Z]/.test(rawHref)){entryWarnings.push('Заглавные буквы в URL');}
      if(rawHref.indexOf('%20')>-1){entryWarnings.push('Пробелы (%20) в URL');}
      if(hasDoubleSlash(rawHref)){entryWarnings.push('Двойные слэши в URL');}
      if(/[^a-z0-9\-._~:/?#[\]@!$&'()*+,;=%]/.test(rawHref.toLowerCase())){entryWarnings.push('Недопустимые символы в URL');}

      var normalizedHref=url.origin+normalizePath(url.pathname)+(url.search||'');
      if(rawHref!==normalizedHref){
        if(isHome&&isHomeTrailingSlashOnlyHrefMismatch(rawHref,url)){
          entryWarnings.push('Для главной страницы отличие только в завершающем "/" — это предупреждение');
        }else{
          hasError=true;
          entryErrors.push('Фактический href: '+normalizedHref);
        }
      }

      var slashPattern=null;
      var hasSlash=url.pathname&&url.pathname.endsWith('/');
      slashPattern=hasSlash?'with':'without';
      if(!isHome){
        if(rows._internalSlashPattern&&rows._internalSlashPattern!==slashPattern){hasError=true;entryErrors.push('Несогласованный trailing slash между языковыми версиями');}
        if(!rows._internalSlashPattern){rows._internalSlashPattern=slashPattern;}
      }

      var hrefHost=url.hostname.toLowerCase();
      if(hreflang){codeCount[hreflang]=(codeCount[hreflang]||0)+1;}
      hrefCount[normalizedHref]=(hrefCount[normalizedHref]||0)+1;
      if(hrefHost!==baseHost){
        if(hrefHost.endsWith('.'+baseHost)||baseHost.endsWith('.'+hrefHost)){hostIssues[normalizedHref]='warn';}
        else{hostIssues[normalizedHref]='error';}
      }

      var row={
        href:rawHref,
        hreflang:hreflang,
        group:group,
        err:hasError,
        msg:entryErrors.join('; '),
        warn:entryWarnings.length>0,
        warnMsg:entryWarnings.join('; '),
        cur:isCurrent,
        slashPattern:slashPattern,
        normalizedHref:normalizedHref,
        hrefHost:hrefHost
      };
      rows.push(row);
    });

    return {rows:rows,warnings:warnings,codeCount:codeCount,hrefCount:hrefCount,hostIssues:hostIssues};
  }

    function runChecker(){removeExistingWidgets();fetch(dataUrl).then(function(r){return r.json();}).then(function(payload){var pageGroups=payload.pageGroups;var indexes=buildSlugIndex(pageGroups);var slugIndex=indexes.slugIndex;var codeIndex=indexes.codeIndex;var aliasMap={};Object.keys(pageGroups).forEach(function(groupKey){aliasMap[groupKey]=groupKey;var group=pageGroups[groupKey];if(Array.isArray(group.aliases)){group.aliases.forEach(function(alias){ensureAlias(aliasMap,alias,groupKey);});}});var alternates=document.querySelectorAll('link[rel="alternate"][hreflang]');var canonical=document.querySelector('link[rel="canonical"]');var canonicalUrl=canonical?canonical.getAttribute('href'):'';var currentPath=cleanPath(location.pathname);var normalizedCurrent=location.origin+normalizePath(location.pathname);var strippedPath=stripLangPrefix(currentPath);var currentMatch=matchSlugWithAliases(slugIndex,currentPath,slugAliasMap)||matchSlugWithAliases(slugIndex,strippedPath,slugAliasMap);var currentGroup=currentMatch?currentMatch.group:aliasMap[currentPath]||aliasMap[strippedPath]||aliasMap[strippedPath.replace(/^\//,'')];var baseHost=location.hostname.toLowerCase();if(alternates.length===0){if(!document.cookie.split(';').some(function(c){return c.trim().indexOf(reloadCookie+'=')===0;})){document.cookie=reloadCookie+'=1; path=/';location.reload();return;}showEmptyWidget();return;}

    var analysis=analyzeAlternates(alternates,{slugIndex:slugIndex,codeIndex:codeIndex,aliasMap:aliasMap,currentGroup:currentGroup,normalizedCurrent:normalizedCurrent,canonicalUrl:canonicalUrl,baseHost:baseHost,origin:location.origin});
    var report=finalizeAnalysis(analysis.rows,analysis.warnings,analysis.codeCount,analysis.hrefCount,analysis.hostIssues,baseHost,normalizedCurrent);
    report.currentPath=currentPath;
    report.currentGroup=currentGroup;
    report.totalAlternates=alternates.length;
    renderWidget(report);
  }).catch(function(err){alert('Ошибка загрузки базы слагов: '+err.message);});}

  function start(){sendTelemetry('install');sendTelemetry('run');setTimeout(runChecker,500);}

  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',start);}else{start();}
})();
