(function(){
  var dataUrl='https://yarikbes.github.io/SEO------/slugs.json';
  var telemetryUrl='https://hreflang-checker.dorian-grei33.workers.dev/ping';
    var specialHreflangHints={
      'in':'Устаревший код, используйте id (например id-ID)',
      'sh':'Устаревший код, используйте sr/hr/bs с регионом'
    };
  var slugAliasMap={'no':'nb','cz':'cs','gr':'el','se':'sv','dk':'da','jp':'ja','cn':'zh','ua':'uk','in':'id','iw':'he'};
  var hreflangCanonicalMap={'no':'nb-NO','no-no':'nb-NO'};
  var reloadCookie='showCloak';
  var widgetClass='hreflang-checker-widget';
  var emptyClass='hreflang-empty-widget';

  function stripLangPrefix(path){return path.replace(/^\/(?:[a-z]{2}(?:-[a-z]{2})?)\//i,'/');}
  function cleanPath(path){var cleaned=path.replace(/\/+/g,'/').replace(/\/$/,'');return cleaned||'/';}
  function normalizePath(path){if(!path)return'/';var normalized=path.replace(/\/+/g,'/');if(normalized.charAt(0)!=='/'){normalized='/'+normalized;}return normalized||'/';}
  function normalizeUrl(raw){var parsed=new URL(raw,location.origin);return parsed.origin+normalizePath(parsed.pathname);}
  function formatMessages(text){return text?text.split('; ').filter(Boolean):[];}

  function primaryLang(code){
    var v=String(code||'').trim().toLowerCase();
    if(!v)return '';
    return v.split('-')[0];
  }
  function safeDecodeUrlPath(input){
    var s=String(input||'');
    try{
      // decodeURIComponent может упасть на частично-сломанных % последовательностях
      return decodeURIComponent(s);
    }catch(e){
      return s;
    }
  }
  function slugForModel(path){
    // Убираем ведущий / и завершающий /, оставляем только значимую часть.
    var p=safeDecodeUrlPath(path);
    p=String(p||'').toLowerCase();
    p=p.replace(/^\/+/, '').replace(/\/+$/, '');
    // Уберём query/fragment на всякий случай
    p=p.split('?')[0].split('#')[0];
    // Оставляем буквы/цифры/дефис/слэш. Поддерживаем кириллицу, чтобы ru/uk и т.п. не превращались в пустоту.
    p=p.replace(/[^a-z0-9\u0400-\u04ff\-\/]/g,'');
    return p;
  }
  function detectSlugScript(path){
    var p=safeDecodeUrlPath(path);
    p=String(p||'');
    var hasCyr=/[\u0400-\u04ff]/.test(p);
    // Latin (включая диакритики)
    var hasLatin=/[A-Za-z\u00C0-\u024F]/.test(p);
    var hasAsciiLatin=/[A-Za-z]/.test(p);
    if(hasCyr&&hasLatin)return 'mixed';
    if(hasCyr)return 'cyrillic';
    if(hasLatin){
      // Отличаем «чисто ASCII» от латиницы с диакритиками
      return /[\u00C0-\u024F]/.test(p)?'latin':'ascii-latin';
    }
    // Если нет букв — это slug-«мусор»/цифры, считаем «other»
    return hasAsciiLatin?'ascii-latin':'other';
  }
  function extractNgrams(text,n){
    var t=String(text||'');
    var grams=[];
    if(!t)return grams;
    if(t.length<n){grams.push(t);return grams;}
    for(var i=0;i<=t.length-n;i+=1){grams.push(t.slice(i,i+n));}
    return grams;
  }
  function buildSlugLanguageModel(slugIndex){
    // Модель по триграммам: для каждого primary языка считаем частоты.
    var model={langs:[],stats:{},vocab:{},vocabSize:0};
    if(!slugIndex)return model;
    Object.keys(slugIndex).forEach(function(rawSlug){
      var entry=slugIndex[rawSlug];
      if(!entry||!entry.codes||!entry.codes.length)return;
      var s=slugForModel(stripLangPrefix(cleanPath(rawSlug)));
      if(!s||s.length<3)return;
      var grams=extractNgrams(s,3);
      grams.forEach(function(g){model.vocab[g]=true;});
      entry.codes.forEach(function(code){
        var lang=primaryLang(code);
        if(!lang)return;
        var st=model.stats[lang];
        if(!st){st={counts:{},total:0};model.stats[lang]=st;}
        grams.forEach(function(g){st.counts[g]=(st.counts[g]||0)+1;st.total+=1;});
      });
    });
    model.langs=Object.keys(model.stats);
    model.vocabSize=Object.keys(model.vocab).length||1;
    return model;
  }
  function guessSlugLanguage(model,path){
    if(!model||!model.langs||!model.langs.length)return {lang:'',confident:false,reason:'no-model'};
    var script=detectSlugScript(path);
    var s=slugForModel(path);
    if(!s||s.length<3)return {lang:'',confident:false,reason:'too-short',script:script};
    var grams=extractNgrams(s,3);
    if(!grams.length)return {lang:'',confident:false,reason:'no-ngrams',script:script};
    var bestLang='';
    var bestScore=-Infinity;
    var secondScore=-Infinity;
    var V=model.vocabSize||1;
    model.langs.forEach(function(lang){
      var st=model.stats[lang];
      var denom=(st.total||0)+V;
      var score=0;
      grams.forEach(function(g){
        var c=(st.counts&&st.counts[g])?st.counts[g]:0;
        // log((c+1)/denom)
        score+=Math.log((c+1)/denom);
      });
      if(score>bestScore){secondScore=bestScore;bestScore=score;bestLang=lang;}
      else if(score>secondScore){secondScore=score;}
    });
    var diff=bestScore-secondScore;
    // Более консервативная уверенность:
    // - короткие/универсальные slug не классифицируем уверенно
    // - ASCII-latin без диакритик НЕ пытаемся различать по «языкам», иначе появляются ложные nl/pl/et и т.п.
    var minLen=8;
    var minGrams=5;
    var baseThreshold=2.4;
    if(grams.length>=10)baseThreshold=2.0;
    if(s.length<minLen||grams.length<minGrams){
      return {lang:bestLang,confident:false,diff:diff,reason:'too-short',script:script};
    }
    // Если slug чисто ASCII (без диакритик/кириллицы), то «конфидентно» разрешаем только en.
    if(script==='ascii-latin'&&bestLang&&bestLang!=='en'){
      return {lang:bestLang,confident:false,diff:diff,reason:'ascii-ambiguous',script:script};
    }
    var confident=(isFinite(diff)&&diff>baseThreshold);
    return {lang:bestLang,confident:confident,diff:diff,script:script};
  }
  function isValidHreflangCode(code){
    if(code===null||code===undefined)return false;
    var raw=String(code).trim();
    if(!raw)return false;
    var lower=raw.toLowerCase();
    if(lower==='x-default')return true;
    var parts=raw.split('-');
    if(parts.length===1){return /^[a-z]{2,3}$/i.test(parts[0]);}
    if(parts.length===2){
      if(!/^[a-z]{2,3}$/i.test(parts[0]))return false;
      if(/^[a-z]{4}$/i.test(parts[1]))return true; // script
      if(/^[a-z]{2}$/i.test(parts[1]))return true; // region
      if(/^\d{3}$/.test(parts[1]))return true; // UN M.49
      return false;
    }
    if(parts.length===3){
      if(!/^[a-z]{2,3}$/i.test(parts[0]))return false;
      if(/^[a-z]{4}$/i.test(parts[1])&&(/^[a-z]{2}$/i.test(parts[2])||/^\d{3}$/.test(parts[2])))return true; // lang-script-region
      if((/^[a-z]{2}$/i.test(parts[1])||/^\d{3}$/.test(parts[1]))&&/^[a-z0-9]{4,8}$/i.test(parts[2]))return true; // lang-region-variant (упрощенно)
      return false;
    }
    if(!/^[a-z]{2,3}$/i.test(parts[0]))return false;
    for(var i=1;i<parts.length;i+=1){if(!/^[a-z0-9]{1,8}$/i.test(parts[i]))return false;}
    return true;
  }

  function normalizeHtmlLang(raw){
    if(raw===null||raw===undefined)return '';
    var value=String(raw).trim();
    if(!value)return '';
    value=value.replace(/_/g,'-');
    var parts=value.split('-').filter(Boolean);
    if(parts.length===0)return '';
    parts[0]=parts[0].toLowerCase();
    if(parts.length>=2){
      if(/^\d{3}$/.test(parts[1])){
        // UN M.49
      }else if(parts[1].length===2){
        parts[1]=parts[1].toUpperCase();
      }else if(parts[1].length===4){
        parts[1]=parts[1].charAt(0).toUpperCase()+parts[1].slice(1).toLowerCase();
      }
    }
    if(parts.length>=3){
      if(/^\d{3}$/.test(parts[2])){
        // UN M.49
      }else if(parts[2].length===2){
        parts[2]=parts[2].toUpperCase();
      }
    }
    return parts.join('-');
  }

  function appendWarn(row,text){
    if(!text)return;
    row.warnMsg=row.warnMsg?row.warnMsg+'; '+text:text;
    row.warn=true;
  }

  function appendErr(row,text){
    if(!text)return;
    row.msg=row.msg?row.msg+'; '+text:text;
    row.err=true;
  }

  function applyHtmlLangCrossCheck(rows,htmlLang){
    if(!htmlLang||!isValidHreflangCode(htmlLang))return;
    var selfRow=null;
    for(var i=0;i<rows.length;i+=1){if(rows[i]&&rows[i].cur){selfRow=rows[i];break;}}
    if(!selfRow)return;
    var selfMatch=(selfRow.matchHreflang||selfRow.hreflang||'').trim();
    if(!selfMatch)return;
    var htmlPrimary=htmlLang.toLowerCase().split('-')[0];
    var selfPrimary=selfMatch.toLowerCase().split('-')[0];
    if(htmlPrimary&&selfPrimary&&htmlPrimary!==selfPrimary){
      appendWarn(selfRow,'<html lang> ('+htmlLang+') не совпадает с self hreflang ('+selfRow.hreflang+')');
    }else if(htmlLang.toLowerCase()!==selfMatch.toLowerCase()){
      appendWarn(selfRow,'<html lang> ('+htmlLang+') отличается от self hreflang ('+selfRow.hreflang+')');
    }
  }

  function buildSingleLanguageRows(context){
    var rows=[];
    var href=location.href;
    var normalizedHref=location.origin+normalizePath(location.pathname)+(location.search||'');
    var row={
      href:href,
      hreflang:context.htmlLang||'',
      matchHreflang:context.htmlLang||'',
      group:context.currentGroup||'',
      err:false,
      msg:'',
      warn:false,
      warnMsg:'',
      cur:true,
      slashPattern:(location.pathname&&location.pathname.endsWith('/'))?'with':'without',
      normalizedHref:normalizedHref,
      hrefHost:location.hostname.toLowerCase()
    };

    appendWarn(row,'Hreflang не найдены (одноязычный режим): выполнены базовые проверки URL');

    if(!context.htmlLang){appendWarn(row,'Не указан атрибут <html lang>');}
    else if(!isValidHreflangCode(context.htmlLang)){appendWarn(row,'Некорректный <html lang>: "'+context.htmlLang+'"');}

    if(!context.canonicalUrl){appendWarn(row,'Не найден <link rel="canonical">');}
    else{
      var canonicalRaw=String(context.canonicalUrl||'');
      var canonicalNormalized=normalizeUrl(canonicalRaw);
      if(canonicalNormalized!==context.normalizedCurrent){appendWarn(row,'Canonical отличается от текущего URL');}
      var canonicalParsed=new URL(canonicalRaw,location.origin);
      var canonicalFull=canonicalParsed.origin+normalizePath(canonicalParsed.pathname)+(canonicalParsed.search||'');
      if(canonicalRaw!==canonicalFull){appendWarn(row,'Canonical не нормализован: фактический href будет '+canonicalFull);}
    }

    // URL-санити как в hreflang
    if(href.indexOf('_')>-1){appendWarn(row,'Нижнее подчёркивание в URL');}
    if(/[A-Z]/.test(href)){appendWarn(row,'Заглавные буквы в URL');}
    if(href.indexOf('%20')>-1){appendWarn(row,'Пробелы (%20) в URL');}
    if(hasDoubleSlash(href)){appendWarn(row,'Двойные слэши в URL');}
    if(/[^a-z0-9\-._~:/?#[\]@!$&'()*+,;=%]/.test(href.toLowerCase())){appendWarn(row,'Недопустимые символы в URL');}
    if(href!==normalizedHref){appendWarn(row,'URL не нормализован');}

    rows.push(row);
    return rows;
  }

  function auditInternalLinks(options){
    var maxLinks=options&&Number.isFinite(options.maxLinks)?options.maxLinks:400;
    var expectedSlashPattern=options&&options.expectedSlashPattern?options.expectedSlashPattern:null;
    var baseHost=options&&options.baseHost?options.baseHost:String(location.hostname||'').toLowerCase();
    var enableSlugChecks=Boolean(options&&options.enableSlugChecks);
    var expectedLang=(options&&options.expectedLang)?String(options.expectedLang):'';
    var currentGroup=(options&&options.currentGroup)?String(options.currentGroup):'';
    var slugIndex=options&&options.slugIndex?options.slugIndex:null;
    var codeIndex=options&&options.codeIndex?options.codeIndex:null;
    var enableNetworkCheck=options&&Object.prototype.hasOwnProperty.call(options,'enableNetworkCheck')?Boolean(options.enableNetworkCheck):true;
    var maxNetworkChecks=options&&Number.isFinite(options.maxNetworkChecks)?options.maxNetworkChecks:120;
    var concurrency=options&&Number.isFinite(options.concurrency)?options.concurrency:8;
    var isMultilingual=Boolean(options&&options.isMultilingual);
    var langModel=options&&options.langModel?options.langModel:null;

    var anchors=Array.prototype.slice.call(document.querySelectorAll('a[href]'));
    var totalFound=anchors.length;
    var scanned=0;
    var truncated=false;
    var errorCount=0;
    var warnCount=0;
    var issueRows=[];
    var seen={};
    var skippedCount=0;
    var externalCount=0;
    var externalSamples=[];
    var partnerCandidateCount=0;
    var unknownInternalCount=0;
    var pageCandidateCount=0;
    var slugCoverage=0;
    var slugIndexReliable=false;
    var networkCheckedCount=0;
    var networkSkippedCount=0;
    var pageCount=0;
    var redirectCount=0;
    var pageIssues=[];
    var redirectIssues=[];
    var redirectSamples=[];
    var pageRows=[];
    var redirectRows=[];
    var occurrencesByUrl={};

    function normalizeLabelText(text){
      return String(text||'').replace(/\s+/g,' ').trim();
    }
    function getAnchorLabel(a){
      try{
        var t=normalizeLabelText(a&&a.textContent?a.textContent:'');
        if(t)return t;
        var aria=normalizeLabelText(a&&a.getAttribute?a.getAttribute('aria-label'):'');
        if(aria)return aria;
        var title=normalizeLabelText(a&&a.getAttribute?a.getAttribute('title'):'');
        if(title)return title;
        var img=a&&a.querySelector?a.querySelector('img[alt]'):null;
        var alt=normalizeLabelText(img&&img.getAttribute?img.getAttribute('alt'):'');
        if(alt)return alt;
        return '';
      }catch(e){return '';}
    }

    function stripHash(url){try{var u=new URL(url,location.origin);return u.origin+u.pathname+(u.search||'');}catch(e){return String(url||'').split('#')[0];}}
    function isProbablyHtml(contentType){if(!contentType)return true;var ct=String(contentType).toLowerCase();return ct.indexOf('text/html')>-1||ct.indexOf('application/xhtml+xml')>-1;}
    function fetchUrlInfo(url){
      // Стараемся не качать body: сначала HEAD, потом GET (только headers, body не читаем).
      // Важно: redirect:'manual' — иначе редирект на другой домен часто даёт "Failed to fetch" (CORS).
      var reqUrl=String(url||'');
      var headOpts={method:'HEAD',redirect:'manual',cache:'no-store',credentials:'same-origin'};
      var getOpts={method:'GET',redirect:'manual',cache:'no-store',credentials:'same-origin',headers:{'Accept':'text/html,*/*;q=0.9'}};
      function mapResponse(res){
        var ct='';
        var loc='';
        var type='';
        try{ct=res&&res.headers?res.headers.get('content-type')||'':'';}catch(e){}
        try{loc=res&&res.headers?res.headers.get('location')||'':'';}catch(e){}
        try{type=res&&res.type?String(res.type):'';}catch(e){}
        return {ok:Boolean(res&&res.ok),status:res&&Number.isFinite(res.status)?res.status:0,redirected:Boolean(res&&res.redirected),finalUrl:res&&res.url?String(res.url):reqUrl,contentType:ct,location:loc,responseType:type,opaqueRedirect:type==='opaqueredirect',error:''};
      }
      return fetch(reqUrl,headOpts).then(function(res){
        // Некоторые сервера возвращают 405 на HEAD — в этом случае пробуем GET
        var status=res&&Number.isFinite(res.status)?res.status:0;
        if(status===405||status===501){throw new Error('HEAD not supported');}
        return mapResponse(res);
      }).catch(function(){
        return fetch(reqUrl,getOpts).then(function(res){return mapResponse(res);});
      }).catch(function(err){
        return {ok:false,status:0,redirected:false,finalUrl:reqUrl,contentType:'',location:'',responseType:'',opaqueRedirect:false,error:(err&&err.message)?String(err.message):'fetch failed'};
      });
    }
    function mapWithConcurrency(items,limit,iter){
      var idx=0;
      var results=new Array(items.length);
      var workers=[];
      function next(){
        if(idx>=items.length)return Promise.resolve();
        var current=idx;idx+=1;
        return Promise.resolve(iter(items[current],current)).then(function(r){results[current]=r;}).catch(function(e){results[current]=e;}).then(next);
      }
      var n=Math.max(1,Math.min(limit||1,items.length));
      for(var w=0;w<n;w+=1){workers.push(next());}
      return Promise.all(workers).then(function(){return results;});
    }

    function isPartnerCandidate(urlObj){
      try{
        var path=String(urlObj.pathname||'').toLowerCase();
        var search=String(urlObj.search||'').toLowerCase();
        if(/\/(go|out|redirect|redir|r|ref|aff|click)\b/.test(path))return true;
        if(/[?&](aff|affiliate|ref|refid|clickid|subid|utm_|gclid|fbclid)=/.test(search))return true;
        return false;
      }catch(e){return false;}
    }

    function isAllowedInternalHost(host){
      var h=String(host||'').toLowerCase();
      if(!h)return false;
      if(h===baseHost)return true;
      // Допускаем языковые поддомены/варианты: de.site.tld, site.tld vs www.site.tld
      if(h.endsWith('.'+baseHost))return true;
      if(baseHost.endsWith('.'+h))return true;
      return false;
    }

    function buildExpectedSlugText(lang,group){
      if(!codeIndex||!lang)return '';
      var normalized=String(lang).trim().toLowerCase();
      var primary=normalized.split('-')[0];
      var expectedEntry=codeIndex[normalized]||codeIndex[primary];
      if(!expectedEntry)return '';
      var slug=null;
      if(group&&expectedEntry.groups&&expectedEntry.groups[group]){slug=expectedEntry.groups[group];}
      else{slug=expectedEntry.defaultSlug;}
      return slug?String(slug):'';
    }

    var internalRecords=[];

    for(var i=0;i<anchors.length;i+=1){
      if(scanned>=maxLinks){truncated=true;break;}
      var a=anchors[i];
      var raw=String(a.getAttribute('href')||'').trim();
      if(!raw)continue;
      if(raw.charAt(0)==='#')continue;
      if(/^javascript:/i.test(raw))continue;
      if(/^mailto:/i.test(raw))continue;
      if(/^tel:/i.test(raw))continue;

      var url;
      try{url=new URL(raw,location.origin);}catch(e){
        warnCount+=1;
        issueRows.push({href:raw,normalizedHref:raw,err:false,msg:'',warn:true,warnMsg:'Некорректный URL в ссылке',cur:false,group:'',hreflang:'',hrefHost:''});
        scanned+=1;
        continue;
      }

      // Внешние ссылки считаем отдельно
      if(url.hostname&&!isAllowedInternalHost(String(url.hostname))){
        externalCount+=1;
        if(externalSamples.length<30){externalSamples.push(url.href);}
        scanned+=1;
        continue;
      }

      var absoluteNoHash=url.origin+url.pathname+(url.search||'');
      var normalizedHref=url.origin+normalizePath(url.pathname)+(url.search||'');

      var label=getAnchorLabel(a);

      if(seen[normalizedHref]){
        // Не плодим сетевые проверки и строки в таблице, но учитываем повторы.
        var occ=occurrencesByUrl[normalizedHref];
        if(!occ){occ={count:0,texts:[],textKeys:{}};occurrencesByUrl[normalizedHref]=occ;}
        occ.count+=1;
        if(label){
          var key=label.toLowerCase();
          if(!occ.textKeys[key]){occ.textKeys[key]=true;occ.texts.push(label);}
        }
        continue;
      }
      seen[normalizedHref]=true;
      var occ2=occurrencesByUrl[normalizedHref];
      if(!occ2){occ2={count:0,texts:[],textKeys:{}};occurrencesByUrl[normalizedHref]=occ2;}
      occ2.count+=1;
      if(label){
        var key2=label.toLowerCase();
        if(!occ2.textKeys[key2]){occ2.textKeys[key2]=true;occ2.texts.push(label);}
      }

      var errs=[];
      var warns=[];

      if(raw.indexOf('_')>-1){warns.push('Нижнее подчёркивание в URL');}
      if(/[A-Z]/.test(raw)){warns.push('Заглавные буквы в URL');}
      if(raw.indexOf('%20')>-1){warns.push('Пробелы (%20) в URL');}
      if(hasDoubleSlash(raw)){warns.push('Двойные слэши в URL');}
      if(/[^a-z0-9\-._~:/?#[\]@!$&'()*+,;=%]/.test(raw.toLowerCase())){warns.push('Недопустимые символы в URL');}

      if(absoluteNoHash!==normalizedHref){warns.push('URL не нормализован');}

      var isHome=url.pathname==='/'||url.pathname==='';
      if(expectedSlashPattern&&(!isHome)){
        var hasSlash=url.pathname&&url.pathname.endsWith('/');
        var pattern=hasSlash?'with':'without';
        if(pattern!==expectedSlashPattern){warns.push('Trailing slash отличается от текущей страницы');}
      }

      var cleanedPath=cleanPath(url.pathname);
      var stripped=stripLangPrefix(cleanedPath);
      var match=(enableSlugChecks&&slugIndex)?(matchSlugWithAliases(slugIndex,cleanedPath,slugAliasMap)||matchSlugWithAliases(slugIndex,stripped,slugAliasMap)):null;
      var partner=isPartnerCandidate(url);
      if(partner){partnerCandidateCount+=1;}
      if(match){pageCandidateCount+=1;}

      internalRecords.push({
        href:raw,
        normalizedHref:normalizedHref,
        hrefHost:baseHost,
        url:stripHash(normalizedHref),
        isSameOrigin:(url.origin===location.origin),
        errs:errs,
        warns:warns,
        partnerCandidate:partner,
        match:match,
        cleanedPath:cleanedPath,
        strippedPath:stripped,
        kind:'',
        httpStatus:0,
        finalUrl:'',
        redirected:false,
        contentType:'',
        fetchError:'',
        opaqueRedirect:false,
        redirectLocation:'',
        occurrences:0,
        distinctAnchorTexts:[]
      });

      scanned+=1;
    }

    function finalizeFromRecords(){
      issueRows=[];
      pageIssues=[];
      redirectIssues=[];
      errorCount=0;
      warnCount=0;
      unknownInternalCount=0;
      pageCount=0;
      redirectCount=0;
      redirectSamples=[];
      pageRows=[];
      redirectRows=[];

      // Надёжность базы: если совпадений очень мало, то нельзя строго утверждать,
      // что URL/slug «не того языка». В таком случае снижаем строгость проверок.
      var pageLikeCount=0;
      internalRecords.forEach(function(r){if(r&&r.kind==='page')pageLikeCount+=1;});
      slugCoverage=pageLikeCount? (pageCandidateCount/pageLikeCount) : 0;
      slugIndexReliable=(pageCandidateCount>=10 && slugCoverage>=0.2);

      internalRecords.forEach(function(rec){
        if(!rec)return;
        var errs=rec.errs||[];
        var warns=rec.warns||[];

        // Дубликаты URL под разными лейблами
        var occ=occurrencesByUrl[rec.normalizedHref];
        if(occ){
          rec.occurrences=occ.count||0;
          rec.distinctAnchorTexts=Array.isArray(occ.texts)?occ.texts.slice(0):[];
          if((occ.count||0)>1 && occ.texts && occ.texts.length>=2){
            var sample=occ.texts.slice(0,5).join(' | ');
            warns.push('Возможная ошибка навигации: разные тексты ссылок ведут на один URL (повторов: '+occ.count+'): '+sample+(occ.texts.length>5?' …':'') );
          }
        }

        var isRedirect=(rec.kind==='redirect');
        if(isRedirect){
          redirectCount+=1;
          if(redirectSamples.length<30){redirectSamples.push({href:rec.href,normalizedHref:rec.normalizedHref,httpStatus:rec.httpStatus,finalUrl:rec.finalUrl,fetchError:rec.fetchError});}
        }else{
          pageCount+=1;
        }

        // HTTP результаты
        if(rec.fetchError){
          errs.push('Не удалось проверить ссылку: '+rec.fetchError);
        }else if(rec.opaqueRedirect){
          // Редирект на другой origin в режиме manual: браузер скрывает Location.
          warns.push('Редирект на другой домен/зону (CORS): финальный URL недоступен');
        }else if(rec.httpStatus){
          if(rec.httpStatus>=400){errs.push('HTTP '+rec.httpStatus);}
          // На всякий случай: если не HTML — это предупреждение (для страниц)
          if(rec.kind==='page'&&!isProbablyHtml(rec.contentType)){
            warns.push('Не HTML (Content-Type: '+String(rec.contentType||'')+')');
          }
        }else if(enableNetworkCheck&&networkSkippedCount){
          // Если включена сетка и часть ссылок не проверялась (лимит), показываем это как предупреждение.
          // Это не ошибка, но влияет на уверенность в классификации page/redirect.
          warns.push('Сетевая проверка не выполнена (лимит)');
        }

        // Проверка соответствия внутреннего URL языку/таблице (ТОЛЬКО для реальных страниц)
        // Важно: на многоязычном сайте ссылка на другую языковую версию (напр. /nl/) — не ошибка.
        if(rec.kind==='page'&&enableSlugChecks&&slugIndex&&expectedLang&&currentGroup){
          if(!rec.match){
            unknownInternalCount+=1;
            if(!rec.partnerCandidate){
              var expectedPrimary=primaryLang(expectedLang);
              var guess=guessSlugLanguage(langModel,(rec.strippedPath||rec.cleanedPath||''));
              // Строгое ERR допускаем только если:
              // - страница реально многоязычная (есть hreflang)
              // - и база достаточно «покрывает» сайт (иначе будет много ложных ERR)
              var canBeStrict=Boolean(isMultilingual && slugIndexReliable);
              if(canBeStrict && guess&&guess.confident&&guess.lang&&expectedPrimary){
                if(guess.lang===expectedPrimary){
                  warns.push('URL не найден в базе, но похоже соответствует языку страницы ('+expectedLang+')');
                }else{
                  errs.push('URL не найден в базе и похоже соответствует другому языку ('+guess.lang+')');
                }
              }else{
                if(guess&&guess.lang&&expectedPrimary&&guess.lang===expectedPrimary&&(guess.confident||guess.script==='cyrillic')){
                  warns.push('URL не найден в базе, но похоже соответствует языку страницы ('+expectedLang+')');
                }else if(guess&&guess.lang&&expectedPrimary&&guess.lang!==expectedPrimary&&(guess.confident||guess.script!=='ascii-latin')){
                  warns.push('URL не найден в базе слагов (подсказка: возможно другой язык — '+guess.lang+')');
                }else{
                  warns.push('URL не найден в базе слагов');
                }
              }
            }
          }else if(rec.match.codes&&rec.match.codes.length&&!codesMatch(rec.match.codes,expectedLang)){
            if(!isMultilingual){
              var expectedSlug=buildExpectedSlugText(expectedLang,rec.match.group||currentGroup);
              if(slugIndexReliable){
                errs.push('Slug не соответствует языку страницы ('+expectedLang+')'+(expectedSlug?'; ожидаемый slug — '+expectedSlug:''));
              }else{
                warns.push('Slug может не соответствовать языку страницы ('+expectedLang+')'+(expectedSlug?'; ожидаемый slug — '+expectedSlug:'')+'; низкое покрытие базы — проверка ослаблена');
              }
            }
          }
        }

        var hasErr=errs.length>0;
        var hasWarn=warns.length>0;
        if(hasErr)errorCount+=1;
        if(hasWarn)warnCount+=1;

        // Полная строка для UI: добавляем ВСЕ ссылки
        var rowObj={href:rec.href,normalizedHref:rec.normalizedHref,err:hasErr,msg:errs.join('; '),warn:hasWarn,warnMsg:warns.join('; '),cur:false,group:'',hreflang:isRedirect?'[redirect]':'[page]',hrefHost:baseHost,kind:rec.kind,httpStatus:rec.httpStatus,finalUrl:rec.finalUrl};
        if(isRedirect){redirectRows.push(rowObj);}else{pageRows.push(rowObj);}

        // Для подсчётов/копирования проблем оставляем отдельные массивы
        if(hasErr||hasWarn){
          issueRows.push(rowObj);
          if(isRedirect){redirectIssues.push(rowObj);}else{pageIssues.push(rowObj);}
        }
      });
    }

    function maybeRunNetworkChecks(){
      if(!enableNetworkCheck)return Promise.resolve();
      // Сетевую проверку делаем только для same-origin URL, иначе будет много CORS ошибок.
      var sameOriginRecords=internalRecords.filter(function(r){return r&&r.isSameOrigin;});
      var toCheck=sameOriginRecords.slice(0,Math.min(maxNetworkChecks,sameOriginRecords.length));
      var skipped=Math.max(0,internalRecords.length-toCheck.length);
      networkSkippedCount=skipped;
      if(toCheck.length===0)return Promise.resolve();
      return mapWithConcurrency(toCheck,concurrency,function(rec){
        return fetchUrlInfo(rec.url).then(function(info){
          networkCheckedCount+=1;
          rec.httpStatus=info.status||0;
          rec.redirected=Boolean(info.redirected);
          rec.contentType=info.contentType||'';
          rec.fetchError=info.error||'';
          rec.opaqueRedirect=Boolean(info.opaqueRedirect);
          rec.redirectLocation=info.location||'';

          // Если это явный 3xx — считаем редиректом и показываем Location (если есть)
          if(rec.httpStatus>=300&&rec.httpStatus<400){
            rec.kind='redirect';
            if(rec.redirectLocation){
              try{rec.finalUrl=new URL(rec.redirectLocation,rec.url).href;}catch(e){rec.finalUrl=rec.redirectLocation;}
            }else{rec.finalUrl='';}
            return;
          }

          // Opaque redirect (обычно редирект на другой origin)
          if(rec.opaqueRedirect){
            rec.kind='redirect';
            rec.finalUrl='';
            rec.fetchError='';
            return;
          }

          // Без редиректов
          rec.finalUrl=info.finalUrl||rec.url;

          var req=stripHash(rec.url);
          var fin=stripHash(rec.finalUrl||rec.url);
          rec.kind=(rec.redirected||(fin&&req&&fin!==req))?'redirect':'page';
        });
      });
    }

    // По умолчанию считаем всё как страницы, затем уточняем после сети
    internalRecords.forEach(function(rec){if(rec)rec.kind='page';});

    return maybeRunNetworkChecks().then(function(){
      finalizeFromRecords();
      return {
        totalFound:totalFound,
        scanned:scanned,
        truncated:truncated,
        skippedCount:skippedCount,
        externalCount:externalCount,
        externalSamples:externalSamples,
        errorCount:errorCount,
        warnCount:warnCount,
        rows:issueRows,
        pageRows:pageRows,
        redirectRows:redirectRows,
        pageIssues:pageIssues,
        redirectIssues:redirectIssues,
        redirectSamples:redirectSamples,
        partnerCandidateCount:partnerCandidateCount,
        unknownInternalCount:unknownInternalCount,
        pageCandidateCount:pageCandidateCount,
        slugIndexReliable:slugIndexReliable,
        slugCoverage:slugCoverage,
        enableSlugChecks:enableSlugChecks,
        expectedLang:expectedLang,
        currentGroup:currentGroup,
        enableNetworkCheck:enableNetworkCheck,
        maxNetworkChecks:maxNetworkChecks,
        networkCheckedCount:networkCheckedCount,
        networkSkippedCount:networkSkippedCount,
        pageCount:pageCount,
        redirectCount:redirectCount
      };
    });
  }

  function looksSingleLanguageHreflangSet(rows){
    // Эвристика: если альтернативы по сути не дают языкового разнообразия
    // (один язык/регион + один URL), то это часто одноязычный сайт, где hreflang избыточен.
    var langSet={};
    var urlSet={};
    var hasSelf=false;
    for(var i=0;i<rows.length;i+=1){
      var r=rows[i];
      if(!r)continue;
      if(r.cur)hasSelf=true;
      var lang=(r.matchHreflang||r.hreflang||'').trim().toLowerCase();
      if(lang&&lang!=='x-default'){langSet[lang]=true;}
      if(r.normalizedHref){urlSet[r.normalizedHref]=true;}
    }
    var langCount=Object.keys(langSet).length;
    var urlCount=Object.keys(urlSet).length;
    return hasSelf&&langCount<=1&&urlCount<=1;
  }
  function normalizeCodes(entry){if(!entry)return[];if(Array.isArray(entry))return entry.filter(Boolean);if(typeof entry==='object'&&Array.isArray(entry.codes))return entry.codes.filter(Boolean);return[];}
  function addCodeMapping(codeIndex,code,groupKey,slug){var normalizedCode=code.toLowerCase();var primary=normalizedCode.split('-')[0];[normalizedCode,primary].forEach(function(key){var entry=codeIndex[key]||{display:code,defaultSlug:null,groups:{}};if(!entry.defaultSlug){entry.defaultSlug=slug;}if(!entry.groups[groupKey]){entry.groups[groupKey]=slug;}codeIndex[key]=entry;});}
  function buildSlugIndex(pageGroups){var slugIndex={};var codeIndex={};Object.keys(pageGroups).forEach(function(rawGroup){var groupKey=/^[a-z]{2}(?:-[a-z]{2})?$/i.test(rawGroup)?'main':rawGroup;var group=pageGroups[rawGroup];Object.keys(group.slugs).forEach(function(slug){var normalizedSlug=slug||'';if(normalizedSlug&&normalizedSlug.charAt(0)!=='/'){normalizedSlug='/'+normalizedSlug;}var codes=normalizeCodes(group.slugs[slug]);var uniqueCodes=[];codes.forEach(function(code){var trimmed=code.trim();if(trimmed&&uniqueCodes.indexOf(trimmed)===-1){uniqueCodes.push(trimmed);}addCodeMapping(codeIndex,trimmed,groupKey,normalizedSlug);});slugIndex[normalizedSlug]={group:groupKey,codes:uniqueCodes};});});return {slugIndex:slugIndex,codeIndex:codeIndex};}
  function matchSlug(index,path){if(!path)return null;var candidates=[];var base=path.charAt(0)==='/'?path:'/'+path;candidates.push(base);if(base.slice(-1)!=='/'){candidates.push(base+'/');}else{candidates.push(base.slice(0,-1));}candidates.push(base.replace(/\/+/g,'/'));for(var i=0;i<candidates.length;i+=1){var candidate=candidates[i];if(!candidate)continue;var match=index[candidate];if(match){return {slug:candidate,group:match.group,codes:match.codes};}}return null;}
    function rewriteSlugByAlias(path,aliasMap){var parts=path.split('/');for(var i=0;i<parts.length;i+=1){if(parts[i]){var lower=parts[i].toLowerCase();if(aliasMap[lower]){parts[i]=aliasMap[lower];return {path:parts.join('/'),from:lower,to:aliasMap[lower]};}break;}}return null;}
    function matchSlugWithAliases(index,path,aliasMap){var direct=matchSlug(index,path);if(direct)return {slug:direct.slug,group:direct.group,codes:direct.codes,aliasUsed:false};var rewrite=rewriteSlugByAlias(path,aliasMap);if(rewrite){var via=matchSlug(index,rewrite.path);if(via){return {slug:via.slug,group:via.group,codes:via.codes,aliasUsed:true,aliasFrom:rewrite.from,aliasTo:rewrite.to,aliasPath:rewrite.path};}}return null;}
  function codesMatch(expected,actual){if(!expected||expected.length===0)return true;var value=(actual||'').trim().toLowerCase();if(!value)return false;var valuePrimary=value.split('-')[0];return expected.some(function(code){var c=code.toLowerCase();if(c===value)return true;var cPrimary=c.split('-')[0];return cPrimary===valuePrimary;});}
  function setStyles(el,css){Object.keys(css).forEach(function(key){el.style[key]=css[key];});}
  function create(tag,css){var el=document.createElement(tag);if(css)setStyles(el,css);return el;}
  function createIsolatedHost(className){
    var host=document.createElement('div');
    host.className=className;
    var root=host;
    try{
      if(host.attachShadow){
        var shadow=host.attachShadow({mode:'open'});
        var style=document.createElement('style');
        style.textContent=':host{all:initial!important;}*,*::before,*::after{box-sizing:border-box;}table{border-spacing:0;}a{color:inherit;}button{font:inherit;}';
        shadow.appendChild(style);
        root=shadow;
      }
    }catch(e){}
    return {host:host,root:root};
  }
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
  function buildClipboardText(rows,errors,warnings,linkAudit){
    var lines=[];
    lines.push('Hreflang: Всего: '+rows.length+' | Ошибок: '+errors.length+' | Предупреждений: '+warnings.length);
    rows.forEach(function(row){
      var parts=[];
      if(row.err&&row.msg){parts.push('ERR: '+row.msg);}
      if(row.warn&&row.warnMsg){parts.push('WARN: '+row.warnMsg);}
      var status=parts.length?parts.join(' | '):'OK';
      lines.push((row.hreflang||'')+'\t'+row.href+'\t'+status);
    });

    if(linkAudit){
      lines.push('');
      var extra=[];
      if(linkAudit.externalCount){extra.push('внешних: '+linkAudit.externalCount);}
      if(linkAudit.enableNetworkCheck){
        extra.push('сетевых проверок: '+(linkAudit.networkCheckedCount||0)+(linkAudit.networkSkippedCount?(' (+не проверено: '+linkAudit.networkSkippedCount+')'):'') );
        extra.push('страниц: '+(linkAudit.pageCount||0));
        extra.push('редиректов: '+(linkAudit.redirectCount||0));
      }
      if(linkAudit.enableSlugChecks){
        if(linkAudit.pageCandidateCount){extra.push('страниц в базе: '+linkAudit.pageCandidateCount);}
        if(linkAudit.partnerCandidateCount){extra.push('партнёр/редирект: '+linkAudit.partnerCandidateCount);}
        if(linkAudit.unknownInternalCount){extra.push('неизвестных: '+linkAudit.unknownInternalCount);}
      }
      lines.push('Ссылки: проверено '+linkAudit.scanned+(linkAudit.truncated?'+':'')+' из '+linkAudit.totalFound+' | проблем: '+linkAudit.errorCount+' ERR, '+linkAudit.warnCount+' WARN'+(extra.length?' | '+extra.join(', '):''));
      if(linkAudit.enableSlugChecks){
        lines.push('Проверка slug по базе: язык '+(linkAudit.expectedLang||'')+' | группа '+(linkAudit.currentGroup||''));
      }else{
        lines.push('Проверка slug по базе: не активна (страница не распознана в базе)');
      }

      function pushAuditRows(label,arr){
        if(!arr||!arr.length)return;
        lines.push('');
        lines.push(label+':');
        arr.forEach(function(r){
          var status2='Все проверки: OK'+(r.httpStatus?(', HTTP '+r.httpStatus):'');
          if(r.err||r.warn){
            var parts2=[];
            if(r.httpStatus){parts2.push('HTTP '+r.httpStatus);}
            if(r.finalUrl&&r.finalUrl!==r.normalizedHref){parts2.push('FINAL: '+r.finalUrl);}
            if(r.err&&r.msg){parts2.push('ERR: '+r.msg);}
            if(r.warn&&r.warnMsg){parts2.push('WARN: '+r.warnMsg);}
            status2=parts2.length?parts2.join(' | '):status2;
          }
          var base=(r.hreflang||'')+'\t'+(r.href||'')+'\t'+status2;
          if((r.err||r.warn)&&r.href&&r.normalizedHref&&r.href!==r.normalizedHref){
            base+='\t'+'Фактический href: '+r.normalizedHref;
          }
          lines.push(base);
        });
      }

      if((linkAudit.pageRows&&linkAudit.pageRows.length)||(linkAudit.redirectRows&&linkAudit.redirectRows.length)){
        pushAuditRows('Страницы',linkAudit.pageRows);
        pushAuditRows('Редиректы/заглушки',linkAudit.redirectRows);
      }else if(linkAudit.rows&&linkAudit.rows.length){
        // fallback для совместимости
        pushAuditRows('Внутренние ссылки',linkAudit.rows);
      }else{
        lines.push('Внутренних ссылок для проверки не найдено.');
      }

      if(linkAudit.externalCount){
        lines.push('');
        lines.push('Внешние/партнёрские ссылки: '+linkAudit.externalCount);
        if(linkAudit.externalSamples&&linkAudit.externalSamples.length){
          linkAudit.externalSamples.forEach(function(u){lines.push('- '+u);});
        }
      }
    }

    return lines.join('\n');
  }

  function showEmptyWidget(){
    var mount=createIsolatedHost(emptyClass);
    var host=mount.host;
    var root=mount.root;
    var panel=create('div');
    panel.style.cssText='position:fixed!important;top:20px!important;left:20px!important;background:#fff!important;border:1px solid #ccc!important;box-shadow:0 2px 10px rgba(0,0,0,0.2)!important;z-index:2147483647!important;max-width:500px!important;font-family:Arial,sans-serif!important;font-size:14px!important;border-radius:8px!important';
    panel.innerHTML='<div style="background:#fff3cd!important;padding:16px!important;border-bottom:1px solid #ccc!important;display:flex!important;justify-content:space-between!important;align-items:center!important;min-height:40px!important"><span style="font-weight:bold!important;color:#856404!important;flex:1!important">Hreflang не найдены</span><button class="hreflang-close-btn" style="background:none!important;border:none!important;font-size:24px!important;line-height:1!important;padding:0!important;margin:0!important;width:24px!important;height:24px!important;min-width:24px!important;min-height:24px!important;flex-shrink:0!important;cursor:pointer!important;color:#856404!important;font-weight:bold!important;display:flex!important;align-items:center!important;justify-content:center!important">X</button></div><div style="padding:20px!important"><p style="margin:0 0 12px 0!important;color:#000!important">На этой странице не найдены теги <code style="background:#f5f5f5!important;padding:2px 6px!important;border-radius:3px!important;color:#000!important">&lt;link rel="alternate" hreflang="..."&gt;</code></p><p style="margin:0!important;color:#333!important;font-size:13px!important"><strong>Возможные причины:</strong><br>&bull; Страница не мультиязычная<br>&bull; Теги скрыты JavaScript (клоакинг)<br>&bull; Теги еще не загружены</p></div>';
    root.appendChild(panel);
    document.body.appendChild(host);
    var btn=panel.querySelector('.hreflang-close-btn');
    if(btn){btn.addEventListener('click',function(ev){ev.preventDefault();ev.stopPropagation();host.remove();},true);} }

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

    var mount=createIsolatedHost(widgetClass);
    var host=mount.host;
    var root=mount.root;

    var widget=create('div');
    widget.style.cssText='position:fixed!important;top:20px!important;left:20px!important;background:#fff!important;border:1px solid #ccc!important;box-shadow:0 2px 10px rgba(0,0,0,0.2)!important;z-index:2147483647!important;max-width:1200px!important;max-height:80vh!important;overflow:auto!important;font-family:Arial,sans-serif!important;font-size:13px!important;border-radius:8px!important';
    root.appendChild(widget);

    var headerBg=errors.length>0?'#ffebee':warnings.length>0?'#fff3cd':'#e8f5e9';
    var headerColor=errors.length>0?'#c62828':warnings.length>0?'#856404':'#2e7d32';
    var header=create('div',{backgroundColor:headerBg,padding:'6px 12px',borderBottom:'1px solid #ccc',display:'flex',justifyContent:'space-between',alignItems:'center',position:'sticky',top:'0',minHeight:'32px'});
    var headerTitle=create('span',{fontWeight:'bold',color:headerColor,flex:'1'});
    headerTitle.textContent='Hreflang Check: '+(errors.length>0?errors.length+' ошибок':warnings.length>0?warnings.length+' предупреждений':'Всё ОК');
    var closeBtn=create('button',{background:'none',border:'none',cursor:'pointer',fontSize:'24px',lineHeight:'1',padding:'0',margin:'0',width:'24px',height:'24px',minWidth:'24px',minHeight:'24px',flexShrink:'0',color:headerColor,fontWeight:'bold',display:'flex',alignItems:'center',justifyContent:'center'});
    closeBtn.textContent='X';
    attachCloseHandler(closeBtn,host);
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

    if(report.linkAudit){
      var audit=report.linkAudit;
      var section=create('div',{padding:'10px 12px',borderTop:'1px solid #e0e0e0',background:'#fafafa'});
      var title=create('div',{fontWeight:'bold',color:'#000',marginBottom:'6px'});
      var extra=[];
      if(audit.externalCount){extra.push('внешних: '+audit.externalCount);} 
      if(audit.enableNetworkCheck){
        extra.push('сетевых проверок: '+(audit.networkCheckedCount||0)+(audit.networkSkippedCount?(' (+не проверено: '+audit.networkSkippedCount+')'):''));
        extra.push('страниц: '+(audit.pageCount||0));
        extra.push('редиректов: '+(audit.redirectCount||0));
      }
      if(audit.enableSlugChecks){
        if(audit.pageCandidateCount){extra.push('страниц в базе: '+audit.pageCandidateCount);} 
        if(audit.partnerCandidateCount){extra.push('партнёр/редирект: '+audit.partnerCandidateCount);} 
        if(audit.unknownInternalCount){extra.push('неизвестных: '+audit.unknownInternalCount);} 
      }
      var summary='Ссылки: проверено '+audit.scanned+(audit.truncated?'+':'')+' из '+audit.totalFound+' | проблем: '+audit.errorCount+' ERR, '+audit.warnCount+' WARN'+(extra.length?' | '+extra.join(', '):'');
      title.textContent=summary;
      section.appendChild(title);
      if(audit.enableSlugChecks){
        var note=create('div',{color:'#555',fontSize:'12px',marginBottom:'8px'});
        var coverageText='';
        if(typeof audit.slugCoverage==='number'&&isFinite(audit.slugCoverage)){
          coverageText='; покрытие базы: '+Math.round(audit.slugCoverage*100)+'%';
        }
        var strictText=(audit.slugIndexReliable===false)?' (проверка ослаблена из-за низкого покрытия базы)':'';
        note.textContent='Проверка slug по базе выполняется для языка страницы: '+(audit.expectedLang||'')+' (группа: '+(audit.currentGroup||'')+')'+coverageText+strictText;
        section.appendChild(note);
      }else{
        var note2=create('div',{color:'#555',fontSize:'12px',marginBottom:'8px'});
        note2.textContent='Проверка slug по базе не активна (страница не распознана в базе); выполнен только URL-санити.';
        section.appendChild(note2);
      }
      function renderAuditTable(rows,label){
        var wrap=create('div',{marginTop:'8px'});
        var h=create('div',{fontWeight:'bold',color:'#000',marginBottom:'4px'});
        h.textContent=label;
        wrap.appendChild(h);
        if(rows&&rows.length>0){
          var auditTable=create('table');
          auditTable.style.cssText='width:100%!important;border-collapse:collapse!important;table-layout:auto!important;background:#fff!important;border:1px solid #e0e0e0!important;border-radius:6px!important';
          var aThead=create('thead');
          var aHr=create('tr');
          aHr.style.cssText='background:#f0f0f0!important';
          ['URL','Статус'].forEach(function(lbl){var th=create('th',{padding:'4px 10px',textAlign:'left',color:'#000',fontWeight:'bold'});th.textContent=lbl;aHr.appendChild(th);});
          aThead.appendChild(aHr);
          auditTable.appendChild(aThead);
          var aBody=document.createElement('tbody');
          rows.forEach(function(r,idx){
            var bg=r.err?'#ffebee':r.warn?'#fff3cd':(idx%2?'#f9f9f9':'#fff');
            var tr=create('tr',{backgroundColor:bg});
            var urlCell=create('td',{padding:'4px 10px',fontSize:'11px',whiteSpace:'nowrap'});
            var linkEl=create('a',{color:r.err?'#c62828':r.warn?'#856404':'#1558d6',textDecoration:'none'});
            linkEl.textContent=r.href;
            linkEl.href=r.href;
            linkEl.target='_blank';
            linkEl.rel='noreferrer noopener';
            urlCell.appendChild(linkEl);
            tr.appendChild(urlCell);

            var statusCell=create('td',{padding:'4px 10px',fontSize:'11px'});
            var isOk=!(r.err||r.warn);
            var hasContent=false;

            if(isOk){
              if(r.httpStatus){
                var httpOk=create('div',{color:'#333',marginBottom:'2px'});
                httpOk.textContent='HTTP: '+r.httpStatus;
                statusCell.appendChild(httpOk);
              }
              var ok=create('div',{color:'#2e7d32',fontWeight:'bold'});
              ok.textContent='Все проверки: OK';
              statusCell.appendChild(ok);
              hasContent=true;
            }
            if((r.err||r.warn)&&r.href!==r.normalizedHref){
              var parsedTop=create('div',{color:r.err?'#c62828':'#856404',fontWeight:'bold',marginBottom:'2px'});
              parsedTop.textContent='Фактический href: '+r.normalizedHref;
              statusCell.appendChild(parsedTop);
              hasContent=true;
            }
            if(!isOk&&r.httpStatus){
              var httpLine=create('div',{color:'#333',marginBottom:'2px'});
              httpLine.textContent='HTTP: '+r.httpStatus;
              statusCell.appendChild(httpLine);
              hasContent=true;
            }
            if(r.finalUrl&&r.finalUrl!==r.normalizedHref){
              var finLine=create('div',{color:'#333',marginBottom:'2px'});
              finLine.textContent='Финальный URL: '+r.finalUrl;
              statusCell.appendChild(finLine);
              hasContent=true;
            }
            if(r.err){statusCell.appendChild(createList('[ERR] Ошибка', '#c62828', formatMessages(r.msg)));hasContent=true;}
            if(r.warn){statusCell.appendChild(createList('[WARN] Предупреждение', '#856404', formatMessages(r.warnMsg)));hasContent=true;}
            if(!hasContent){var ok2=create('span',{color:'#2e7d32'});ok2.textContent='OK';statusCell.appendChild(ok2);}
            tr.appendChild(statusCell);
            aBody.appendChild(tr);
          });
          auditTable.appendChild(aBody);
          wrap.appendChild(auditTable);
        }else{
          var ok=create('div',{color:'#2e7d32',fontSize:'12px'});
          ok.textContent='Проблем не найдено.';
          wrap.appendChild(ok);
        }
        return wrap;
      }

      // Новая логика: отдельно страницы и редиректы
      if(audit.pageRows||audit.redirectRows){
        section.appendChild(renderAuditTable(audit.pageRows,'Страницы (проверка slug применяется)'));
        section.appendChild(renderAuditTable(audit.redirectRows,'Редиректы/заглушки (проверка slug НЕ применяется), только базовые проверки'));
      }else if(audit.rows&&audit.rows.length>0){
        // fallback
        section.appendChild(renderAuditTable(audit.rows,'Внутренние ссылки'));
      }else{
        var ok=create('div',{color:'#2e7d32',fontSize:'12px'});
        ok.textContent='Внутренних ссылок для проверки не найдено.';
        section.appendChild(ok);
      }

      if(audit.externalCount){
        var ext=create('div',{marginTop:'10px',color:'#000'});
        var extTitle=create('div',{fontWeight:'bold',marginBottom:'4px'});
        extTitle.textContent='Внешние/партнёрские ссылки: '+audit.externalCount+' (как страницы не проверяются)';
        ext.appendChild(extTitle);
        if(audit.externalSamples&&audit.externalSamples.length){
          var extHint=create('div',{color:'#555',fontSize:'12px',marginBottom:'4px'});
          extHint.textContent='Примеры (первые '+audit.externalSamples.length+'): ';
          ext.appendChild(extHint);
          audit.externalSamples.forEach(function(u){
            var line=create('div',{fontSize:'11px'});
            line.textContent='- '+u;
            ext.appendChild(line);
          });
        }
        section.appendChild(ext);
      }
      widget.appendChild(section);
    }

    var footer=create('div',{padding:'8px 12px',background:'#f5f5f5',borderTop:'1px solid #ccc',color:'#000',position:'sticky',bottom:'0',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'12px'});
    var footerText=create('span',{color:'#000'});
    footerText.textContent='Всего: '+totalAlternates+' | Ошибок: '+errors.length+' | Предупреждений: '+warnings.length;
    footer.appendChild(footerText);
    var copyBtn=create('button',{background:'#1558d6',color:'#fff',border:'none',padding:'6px 10px',borderRadius:'4px',cursor:'pointer',fontWeight:'bold'});
    copyBtn.textContent='Скопировать результат';
    var copyBtnBase={bg:'#1558d6',text:'Скопировать результат'};
    function flashCopyBtn(state){
      try{
        if(!copyBtn)return;
        if(copyBtn._flashTimer){clearTimeout(copyBtn._flashTimer);copyBtn._flashTimer=null;}
        if(state==='ok'){
          copyBtn.style.background='#2e7d32';
          copyBtn.textContent='Скопировано!';
        }else if(state==='error'){
          copyBtn.style.background='#c62828';
          copyBtn.textContent='Ошибка копирования';
        }else{
          copyBtn.style.background=copyBtnBase.bg;
          copyBtn.textContent=copyBtnBase.text;
          return;
        }
        copyBtn._flashTimer=setTimeout(function(){flashCopyBtn('reset');},1500);
      }catch(e){}
    }
    copyBtn.addEventListener('click',function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      var text=buildClipboardText(rows,errors,warnings,report.linkAudit);
      if(navigator.clipboard&&navigator.clipboard.writeText){
        navigator.clipboard.writeText(text).then(function(){flashCopyBtn('ok');}).catch(function(err){flashCopyBtn('error');alert('Не удалось скопировать: '+err.message);});
      }else{
        flashCopyBtn('error');
        alert('Копирование не поддерживается в этом браузере');
      }
    });
    footer.appendChild(copyBtn);
    widget.appendChild(footer);
    document.body.appendChild(host);
  }

  function analyzeAlternates(alternates,context){
    var slugIndex=context.slugIndex;
    var codeIndex=context.codeIndex;
    var aliasMap=context.aliasMap;
    var langModel=context.langModel;
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
      if(!isValidHreflangCode(hreflangForMatch)){
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
        else if(/^[a-z]{2,3}$/i.test(hreflangForMatch)&&lowerHreflang!=='x-default'){entryWarnings.push('Рекомендуется указать регион (например '+hreflangForMatch+'-XX)');}
      }
      if(/^https?[:/][^/]/.test(rawHref)){hasError=true;entryErrors.push('Неправильный протокол в URL');}
      if(!match){
        // Если группа страницы не определена, значит сайт/страница, скорее всего, не из нашей базы.
        // В этом режиме не пытаемся «наказывать» за предположения по языку: это даст много ложных ERR.
        if(!currentGroup){
          entryWarnings.push('URL не найден в базе слагов');
        }else{
          var expectedPrimary=primaryLang(hreflangForMatch);
          var guess=guessSlugLanguage(langModel,stripped);
          if(guess&&guess.confident&&guess.lang&&expectedPrimary){
            if(guess.lang===expectedPrimary){
              entryWarnings.push('URL не найден в базе, но похоже соответствует языку hreflang ('+hreflangForMatch+')');
            }else{
              hasError=true;
              entryErrors.push('URL не найден в базе и похоже соответствует другому языку ('+guess.lang+')');
            }
          }else{
            entryWarnings.push('URL не найден в базе слагов');
          }
          if(currentGroup&&group&&group!==currentGroup){hasError=true;entryErrors.push('Неправильная группа: '+group+' вместо '+currentGroup);} 
        }
      }else if(matchAliasUsed){entryWarnings.push('Slug использует /'+aliasFrom+'; рекомендуется /'+aliasTo);}
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
        matchHreflang:hreflangForMatch,
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

    function runChecker(){removeExistingWidgets();fetch(dataUrl).then(function(r){return r.json();}).then(function(payload){var pageGroups=payload.pageGroups;var indexes=buildSlugIndex(pageGroups);var slugIndex=indexes.slugIndex;var codeIndex=indexes.codeIndex;var langModel=buildSlugLanguageModel(slugIndex);var aliasMap={};Object.keys(pageGroups).forEach(function(groupKey){aliasMap[groupKey]=groupKey;var group=pageGroups[groupKey];if(Array.isArray(group.aliases)){group.aliases.forEach(function(alias){ensureAlias(aliasMap,alias,groupKey);});}});var alternates=document.querySelectorAll('link[rel="alternate"][hreflang]');var canonical=document.querySelector('link[rel="canonical"]');var canonicalUrl=canonical?canonical.getAttribute('href'):'';var htmlLang=normalizeHtmlLang(document.documentElement?document.documentElement.getAttribute('lang'):'' );var currentPath=cleanPath(location.pathname);var normalizedCurrent=location.origin+normalizePath(location.pathname);var strippedPath=stripLangPrefix(currentPath);var currentMatch=matchSlugWithAliases(slugIndex,currentPath,slugAliasMap)||matchSlugWithAliases(slugIndex,strippedPath,slugAliasMap);var currentGroup=currentMatch?currentMatch.group:aliasMap[currentPath]||aliasMap[strippedPath]||aliasMap[strippedPath.replace(/^\//,'')];var baseHost=location.hostname.toLowerCase();

    var isHomeCurrent=(location.pathname==='/'||location.pathname==='');
    var expectedSlashPattern=isHomeCurrent?null:((location.pathname&&location.pathname.endsWith('/'))?'with':'without');
    var expectedLang=htmlLang||'';
    var enableSlugChecks=Boolean(currentGroup&&slugIndex&&codeIndex);

    function afterLinkAudit(linkAudit){
      if(alternates.length===0){
        if(!document.cookie.split(';').some(function(c){return c.trim().indexOf(reloadCookie+'=')===0;})){
          document.cookie=reloadCookie+'=1; path=/';
          location.reload();
          return;
        }
        var singleRows=buildSingleLanguageRows({canonicalUrl:canonicalUrl,normalizedCurrent:normalizedCurrent,currentGroup:currentGroup,htmlLang:htmlLang});
        var singleReport=finalizeAnalysis(singleRows,[],{}, {}, {}, baseHost, normalizedCurrent);
        singleReport.currentPath=currentPath;
        singleReport.currentGroup=currentGroup;
        singleReport.totalAlternates=0;
        singleReport.linkAudit=linkAudit;
        renderWidget(singleReport);
        return;
      }

      var analysis=analyzeAlternates(alternates,{slugIndex:slugIndex,codeIndex:codeIndex,aliasMap:aliasMap,langModel:langModel,currentGroup:currentGroup,normalizedCurrent:normalizedCurrent,canonicalUrl:canonicalUrl,baseHost:baseHost,origin:location.origin});
      // Уточняем язык страницы по self hreflang, если он есть
      for(var si=0;si<analysis.rows.length;si+=1){if(analysis.rows[si]&&analysis.rows[si].cur){expectedLang=analysis.rows[si].matchHreflang||analysis.rows[si].hreflang||expectedLang;break;}}
      if(linkAudit&&linkAudit.enableSlugChecks){linkAudit.expectedLang=expectedLang;}
      applyHtmlLangCrossCheck(analysis.rows,htmlLang);
      if(looksSingleLanguageHreflangSet(analysis.rows)){
        // Если нашёлся только self, подсвечиваем как подсказку: hreflang может быть избыточен.
        for(var i=0;i<analysis.rows.length;i+=1){if(analysis.rows[i]&&analysis.rows[i].cur){appendWarn(analysis.rows[i],'Набор hreflang выглядит одноязычным (возможно hreflang не нужен)');break;}}
      }
      var report=finalizeAnalysis(analysis.rows,analysis.warnings,analysis.codeCount,analysis.hrefCount,analysis.hostIssues,baseHost,normalizedCurrent);
      report.currentPath=currentPath;
      report.currentGroup=currentGroup;
      report.totalAlternates=alternates.length;
      report.linkAudit=linkAudit;
      renderWidget(report);
    }

    var isMultilingualPage=Boolean(alternates&&alternates.length>0);
    auditInternalLinks({maxLinks:400,expectedSlashPattern:expectedSlashPattern,baseHost:baseHost,enableSlugChecks:enableSlugChecks,expectedLang:expectedLang,currentGroup:currentGroup,slugIndex:slugIndex,codeIndex:codeIndex,langModel:langModel,isMultilingual:isMultilingualPage,enableNetworkCheck:true,maxNetworkChecks:120,concurrency:8}).then(afterLinkAudit).catch(function(e){
      // Если сетевой аудит упал, всё равно покажем отчёт, но без сетевой части
      auditInternalLinks({maxLinks:400,expectedSlashPattern:expectedSlashPattern,baseHost:baseHost,enableSlugChecks:enableSlugChecks,expectedLang:expectedLang,currentGroup:currentGroup,slugIndex:slugIndex,codeIndex:codeIndex,langModel:langModel,isMultilingual:isMultilingualPage,enableNetworkCheck:false}).then(afterLinkAudit);
    });
  }).catch(function(err){alert('Ошибка загрузки базы слагов: '+err.message);});}

  function start(){sendTelemetry('install');sendTelemetry('run');setTimeout(runChecker,500);}

  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',start);}else{start();}
})();
