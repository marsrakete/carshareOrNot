(function(){
  'use strict';

  /**
   * Creates the sharing controller without starting UI or network work.
   * @param {Object} dependencies - Explicit controller dependencies.
   * @param {Object} dependencies.state - Shared state container; its sections may be replaced.
   * @param {Function} dependencies.calculateDisplayedResult - Application callback calculateDisplayedResult; called only after initialization.
   * @param {Function} dependencies.fmtEUR - Application callback fmtEUR; called only after initialization.
   * @param {Function} dependencies.describeRecommendationReason - Explains the displayed cost difference.
   * @returns {Object} Functions owned by this controller.
   */
  function create(dependencies){
    var providerData = window.CarshareData;
    var identifiers = window.CarshareIdentifiers;
    var limits = window.CarshareLimits;
    var defaultUsage = providerData.defaultUsage;
    var defaultProviders = providerData.defaultProviders;
    var normalizeTariffData = providerData.normalizeTariffData;
    var normalizeLocationEntry = window.CarshareStateValidation.normalizeLocationEntry;
    var isObject = window.CarshareStateValidation.isObject;
    var normalizeSelection = window.CarshareStateValidation.normalizeSelection;
    var isValidSharedState = window.CarshareStateValidation.isValidSharedState;
    var filterProviderLocations = window.CarshareStateValidation.filterProviderLocations;
    var state = dependencies.state;
    var calculateDisplayedResult = dependencies.calculateDisplayedResult;
    var fmtEUR = dependencies.fmtEUR;
    var describeRecommendationReason = dependencies.describeRecommendationReason;

    var SHARE_FORMAT_VERSION = 2;

    /**
     * Converts bytes to URL-safe Base64 without padding.
     * @param {Uint8Array} bytes - Bytes to encode.
     * @returns {string} URL-safe Base64 text.
     */
    function bytesToBase64Url(bytes){
      var binary = '';
      var chunkSize = 8192;
      for(var offset = 0; offset < bytes.length; offset += chunkSize){
        var chunk = bytes.subarray(offset, offset + chunkSize);
        binary += String.fromCharCode.apply(null, chunk);
      }
      return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    }

    /**
     * Converts URL-safe Base64 text back to bytes.
     * @param {string} encoded - URL-safe Base64 text.
     * @returns {Uint8Array} Decoded bytes.
     */
    function base64UrlToBytes(encoded){
      var normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
      while(normalized.length % 4 !== 0){
        normalized += '=';
      }
      var binary = atob(normalized);
      var bytes = new Uint8Array(binary.length);
      for(var index = 0; index < binary.length; index += 1){
        bytes[index] = binary.charCodeAt(index);
      }
      return bytes;
    }

    /**
     * Reads a stream while refusing data beyond a configured byte limit.
     * @param {ReadableStream} stream - Stream producing binary chunks.
     * @param {number} maximumBytes - Largest permitted combined chunk size.
     * @returns {Promise<Uint8Array>} Complete bytes when the limit is respected.
     */
    async function readStreamWithinLimit(stream, maximumBytes){
      var reader = stream.getReader();
      var chunks = [];
      var totalBytes = 0;
      while(true){
        var result = await reader.read();
        if(result.done){
          break;
        }
        totalBytes += result.value.byteLength;
        if(totalBytes > maximumBytes){
          await reader.cancel();
          throw new Error('share-size');
        }
        chunks.push(result.value);
      }
      var bytes = new Uint8Array(totalBytes);
      var offset = 0;
      chunks.forEach(function(chunk){
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      });
      return bytes;
    }

    /**
     * Encodes a complete state snapshot for use in a share URL.
     * @param {Object} snapshot - Application state to encode.
     * @returns {Promise<string>} Versioned compressed or plain payload.
     */
    async function encodeSharePayload(snapshot){
      var wrapper = { version: SHARE_FORMAT_VERSION, state: snapshot };
      var bytes = new TextEncoder().encode(JSON.stringify(wrapper));
      if(bytes.byteLength > limits.MAX_SHARE_DECOMPRESSED_BYTES){
        throw new Error('share-size');
      }
      if(typeof CompressionStream !== 'undefined'){
        try{
          var compressedStream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
          var compressedBytes = await readStreamWithinLimit(compressedStream, limits.MAX_SHARE_ENCODED_BYTES);
          var compressedPayload = 'g.' + bytesToBase64Url(compressedBytes);
          if(compressedPayload.length > limits.MAX_SHARE_PAYLOAD_CHARACTERS){
            throw new Error('share-size');
          }
          return compressedPayload;
        }catch(error){
          if(error && error.message === 'share-size'){
            throw error;
          }
          // Uncompressed encoding remains interoperable when compression is unavailable at runtime.
        }
      }
      var plainPayload = 'j.' + bytesToBase64Url(bytes);
      if(plainPayload.length > limits.MAX_SHARE_PAYLOAD_CHARACTERS){
        throw new Error('share-size');
      }
      return plainPayload;
    }

    /**
     * Decodes a state wrapper from a versioned share payload.
     * @param {string} payload - Payload stored after the share hash marker.
     * @returns {Promise<Object>} Parsed wrapper containing version and state.
     */
    async function decodeSharePayload(payload){
      if(typeof payload !== 'string' || payload.length < 3 || payload.length > limits.MAX_SHARE_PAYLOAD_CHARACTERS || payload.charAt(1) !== '.'){
        throw new Error('share-format');
      }
      var encoding = payload.charAt(0);
      var bytes = base64UrlToBytes(payload.slice(2));
      if(bytes.byteLength > limits.MAX_SHARE_ENCODED_BYTES){
        throw new Error('share-size');
      }
      if(encoding === 'g'){
        if(typeof DecompressionStream === 'undefined'){
          throw new Error('share-compression-unsupported');
        }
        var decompressedStream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
        bytes = await readStreamWithinLimit(decompressedStream, limits.MAX_SHARE_DECOMPRESSED_BYTES);
      } else if(encoding !== 'j'){
        throw new Error('share-encoding');
      }
      if(bytes.byteLength > limits.MAX_SHARE_DECOMPRESSED_BYTES){
        throw new Error('share-size');
      }
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    }

    /**
     * Replaces current state with a validated shared snapshot.
     * @param {Object} snapshot - Validated application state.
     * @returns {void}
     */
    function applySharedState(snapshot){
      state.own = snapshot.own;
      state.usage = snapshot.usage;
      state.location = Object.assign({}, snapshot.location, { byProvider: Object.assign(Object.create(null), snapshot.location.byProvider) });
      state.providers = snapshot.providers;
      state.selection = normalizeSelection(snapshot.selection);
    }

    /**
     * Creates a share snapshot containing only providers that differ from built-in defaults.
     * @returns {Object} Compact state plus provider overrides and removed default identifiers.
     */
    function createCompactShareState(){
      var defaults = defaultProviders();
      var overrides = [];
      var removedProviderIds = [];
      state.providers.forEach(function(provider){
        var defaultProvider = defaults.find(function(candidate){ return candidate.id === provider.id; });
        if(!defaultProvider || JSON.stringify(provider) !== JSON.stringify(defaultProvider)){
          overrides.push(provider);
        }
      });
      defaults.forEach(function(defaultProvider){
        var stillPresent = state.providers.some(function(provider){ return provider.id === defaultProvider.id; });
        if(!stillPresent){
          removedProviderIds.push(defaultProvider.id);
        }
      });
      return {
        own: state.own,
        usage: state.usage,
        location: Object.assign({}, state.location, { byProvider: filterProviderLocations(state.location.byProvider, state.providers) }),
        selection: state.selection,
        providerOverrides: overrides,
        removedProviderIds: removedProviderIds
      };
    }

    /**
     * Reconstructs complete provider data for a compact version-two share state.
     * @param {Object} snapshot - Compact decoded state.
     * @returns {Object} State with a complete providers collection.
     */
    function expandCompactShareState(snapshot){
      if(Array.isArray(snapshot.providers)){
        return snapshot;
      }
      var providers = defaultProviders();
      var removedProviderIds = snapshot.removedProviderIds;
      if(!Array.isArray(removedProviderIds)){
        removedProviderIds = [];
      }
      if(removedProviderIds.length > limits.MAX_PROVIDERS || !removedProviderIds.every(identifiers.isValidProviderId) || new Set(removedProviderIds).size !== removedProviderIds.length){
        throw new Error('provider-identifiers');
      }
      providers = providers.filter(function(provider){ return removedProviderIds.indexOf(provider.id) === -1; });
      var overrides = snapshot.providerOverrides;
      if(!Array.isArray(overrides)){
        overrides = [];
      }
      if(overrides.length > limits.MAX_PROVIDERS || !identifiers.hasValidProviderIdentifiers(overrides)){
        throw new Error('provider-identifiers');
      }
      if(overrides.length > 0 && !limits.hasLimitedProviderStructure(overrides)){
        throw new Error('provider-size');
      }
      overrides.forEach(function(override){
        var existingIndex = providers.findIndex(function(provider){ return provider.id === override.id; });
        if(existingIndex >= 0){
          providers[existingIndex] = override;
        } else {
          providers.push(override);
        }
      });
      snapshot.providers = providers;
      return snapshot;
    }

    /**
     * Loads and applies shared settings from the current URL hash.
     * @returns {Promise<Object>} Result with load state and a user-facing message.
     */
    async function loadSharedState(){
      var marker = '#share=';
      if(window.location.hash.indexOf(marker) !== 0){
        return { found: false, loaded: false, message: '' };
      }
      try{
        var encodedPayload = window.location.hash.slice(marker.length);
        if(encodedPayload.length > limits.MAX_SHARE_PAYLOAD_CHARACTERS * 3){
          throw new Error('share-size');
        }
        var payload = decodeURIComponent(encodedPayload);
        var wrapper = await decodeSharePayload(payload);
        if(isObject(wrapper) && wrapper.version === 2 && isObject(wrapper.state)){
          wrapper.state = expandCompactShareState(wrapper.state);
        }
        if(isObject(wrapper) && isObject(wrapper.state) && isObject(wrapper.state.usage)){
          var sharedUsage = Object.assign(defaultUsage(), wrapper.state.usage);
          if(typeof wrapper.state.usage.vergleichsjahre !== 'number' && isObject(wrapper.state.own) && typeof wrapper.state.own.haltedauer === 'number'){
            sharedUsage.vergleichsjahre = Math.max(wrapper.state.own.haltedauer, 1);
          }
          wrapper.state.usage = sharedUsage;
        }
        if(isObject(wrapper) && isObject(wrapper.state)){
          wrapper.state.selection = normalizeSelection(wrapper.state.selection);
        }
        var supportedVersion = isObject(wrapper) && wrapper.version === SHARE_FORMAT_VERSION;
        if(!supportedVersion || !isValidSharedState(wrapper.state)){
          throw new Error('share-state');
        }
        wrapper.state.providers = normalizeTariffData(wrapper.state.providers);
        Object.keys(wrapper.state.location.byProvider).forEach(function(providerId){
          wrapper.state.location.byProvider[providerId] = normalizeLocationEntry(wrapper.state.location.byProvider[providerId]);
        });
        applySharedState(wrapper.state);
        return { found: true, loaded: true, message: 'Geteilte Einstellungen wurden geladen.' };
      }catch(error){
        if(error && error.message === 'share-size'){
          return { found: true, loaded: false, message: 'Der geteilte Link ist zu groß.' };
        }
        return { found: true, loaded: false, message: 'Der geteilte Link ist ungültig oder wird von diesem Browser nicht unterstützt.' };
      }
    }

    /**
     * Creates a URL containing the complete current state in its hash.
     * @returns {Promise<string>} Shareable URL.
     */
    async function createShareUrl(){
      var payload = await encodeSharePayload(createCompactShareState());
      var url = new URL(window.location.href);
      url.hash = 'share=' + payload;
      return url.toString();
    }

    /**
     * Displays a share URL in a selectable fallback field.
     * @param {string} url - URL the user should copy manually.
     * @returns {void}
     */
    function showShareFallback(url){
      var fallback = document.getElementById('share-fallback');
      fallback.hidden = false;
      fallback.value = url;
      fallback.focus();
      fallback.select();
      document.getElementById('share-status').textContent = 'Automatisches Teilen oder Kopieren ist hier nicht verfügbar. Der Link ist zum manuellen Kopieren markiert.';
    }

    /**
     * Copies a share URL or exposes it for manual copying.
     * @param {string} url - URL to copy.
     * @returns {Promise<void>} Resolves after copying or showing the fallback field.
     */
    async function copyShareUrl(url){
      if(navigator.clipboard && typeof navigator.clipboard.writeText === 'function'){
        try{
          await navigator.clipboard.writeText(url);
          document.getElementById('share-status').textContent = 'Link wurde kopiert.';
          return;
        }catch(error){
          // The visible fallback below keeps sharing possible without clipboard permission.
        }
      }
      showShareFallback(url);
    }

    /**
     * Opens the native share sheet when available and otherwise copies the state URL.
     * @returns {Promise<void>} Resolves after the share interaction or fallback completes.
     */
    async function shareCurrentState(){
      var button = document.getElementById('share-btn');
      var status = document.getElementById('share-status');
      var fallback = document.getElementById('share-fallback');
      button.disabled = true;
      fallback.hidden = true;
      status.textContent = 'Link wird erstellt …';
      try{
        var url = await createShareUrl();
        var shareData = {
          title: 'Auto oder Carsharing?',
          text: 'Meine Einstellungen für den Vergleich von eigenem Auto und Carsharing.',
          url: url
        };
        var nativeShareAvailable = typeof navigator.share === 'function';
        if(nativeShareAvailable && typeof navigator.canShare === 'function'){
          nativeShareAvailable = navigator.canShare(shareData);
        }
        if(nativeShareAvailable){
          try{
            await navigator.share(shareData);
            status.textContent = 'Geteilt.';
            return;
          }catch(error){
            if(error && error.name === 'AbortError'){
              status.textContent = 'Teilen wurde abgebrochen.';
              return;
            }
          }
        }
        await copyShareUrl(url);
      }catch(error){
        if(error && error.message === 'share-size'){
          status.textContent = 'Die Einstellungen sind zu umfangreich für einen Teilen-Link.';
          return;
        }
        status.textContent = 'Der Link konnte nicht erstellt werden.';
      }finally{
        button.disabled = false;
      }
    }

    /**
     * Draws wrapped text onto a canvas within a maximum width.
     * @param {CanvasRenderingContext2D} context - Canvas drawing context.
     * @param {string} text - Text to draw.
     * @param {number} x - Left position in pixels.
     * @param {number} y - First baseline in pixels.
     * @param {number} maxWidth - Maximum line width in pixels.
     * @param {number} lineHeight - Distance between baselines in pixels.
     * @returns {number} Baseline position after the final line.
     */
    function drawWrappedCanvasText(context, text, x, y, maxWidth, lineHeight){
      var words = text.split(' ');
      var line = '';
      var currentY = y;
      words.forEach(function(word){
        var candidate = line;
        if(candidate){
          candidate += ' ';
        }
        candidate += word;
        if(line && context.measureText(candidate).width > maxWidth){
          context.fillText(line, x, currentY);
          line = word;
          currentY += lineHeight;
        } else {
          line = candidate;
        }
      });
      if(line){
        context.fillText(line, x, currentY);
      }
      return currentY;
    }

    /**
     * Adds a rounded rectangle path with a fallback for browsers without Canvas roundRect.
     * @param {CanvasRenderingContext2D} context - Canvas drawing context.
     * @param {number} x - Left edge in pixels.
     * @param {number} y - Top edge in pixels.
     * @param {number} width - Rectangle width in pixels.
     * @param {number} height - Rectangle height in pixels.
     * @param {number} radius - Corner radius in pixels.
     * @returns {void} No return value.
     */
    function addRoundedRectanglePath(context, x, y, width, height, radius){
      if(typeof context.roundRect === 'function'){
        context.roundRect(x, y, width, height, radius);
        return;
      }
      context.moveTo(x + radius, y);
      context.lineTo(x + width - radius, y);
      context.quadraticCurveTo(x + width, y, x + width, y + radius);
      context.lineTo(x + width, y + height - radius);
      context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
      context.lineTo(x + radius, y + height);
      context.quadraticCurveTo(x, y + height, x, y + height - radius);
      context.lineTo(x, y + radius);
      context.quadraticCurveTo(x, y, x + radius, y);
      context.closePath();
    }

    /**
     * Downloads a blob through a temporary object URL.
     * @param {Blob} blob - File contents to download.
     * @param {string} filename - Suggested download filename.
     * @returns {void} No return value.
     */
    function downloadBlob(blob, filename){
      var imageUrl = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = imageUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function(){ URL.revokeObjectURL(imageUrl); }, 0);
    }

    /**
     * Creates a polished PNG summary of the current comparison.
     * @returns {Promise<Blob>} PNG image blob.
     */
    function createResultImageBlob(){
      var result = calculateDisplayedResult();
      var canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 630;
      var context = canvas.getContext('2d');
      var gradient = context.createLinearGradient(0, 0, 1200, 630);
      gradient.addColorStop(0, '#dff4e8');
      gradient.addColorStop(1, '#f7fbf6');
      context.fillStyle = gradient;
      context.fillRect(0, 0, 1200, 630);
      context.fillStyle = '#ffffff';
      context.beginPath();
      addRoundedRectanglePath(context, 70, 64, 1060, 502, 28);
      context.fill();
      context.fillStyle = '#173f35';
      context.font = '700 48px sans-serif';
      context.fillText('Auto oder Carsharing?', 120, 135);
      context.font = '24px sans-serif';
      context.fillStyle = '#557169';
      context.fillText('Mein persönlicher Jahresvergleich', 120, 177);
      var largestTotal = Math.max(result.own.total, result.alternative.total, 1);
      var ownWidth = Math.max(24, 380 * result.own.total / largestTotal);
      context.fillStyle = '#ad493d';
      context.fillRect(120, 245, ownWidth, 26);
      context.fillStyle = '#167c63';
      var providerWidth = 0;
      if(result.alternative){
        providerWidth = Math.max(24, 380 * result.alternative.total / largestTotal);
      }
      context.fillRect(120, 355, providerWidth, 26);
      context.fillStyle = '#173f35';
      context.font = '700 28px sans-serif';
      context.fillText('Eigenes Auto', 120, 230);
      context.fillText(fmtEUR(result.own.total) + ' / Jahr', 530, 270);
      context.fillText(result.providerName, 120, 340);
      if(result.alternative){
        context.fillText(fmtEUR(result.alternative.total) + ' / Jahr', 530, 380);
      }
      context.fillStyle = '#167c63';
      context.font = '700 58px sans-serif';
      if(result.alternative){
        context.fillText(fmtEUR(Math.abs(result.own.total - result.alternative.total)), 730, 280);
      }
      context.font = '700 24px sans-serif';
      context.fillText('Unterschied pro Jahr', 730, 320);
      context.fillStyle = '#557169';
      context.font = '20px sans-serif';
      drawWrappedCanvasText(context, describeRecommendationReason(result), 730, 370, 330, 30);
      context.fillStyle = '#173f35';
      context.font = '18px sans-serif';
      context.fillText('carshareOrNot · marsrakete.de', 120, 520);
      return new Promise(function(resolve, reject){
        canvas.toBlob(function(blob){
          if(blob){
            resolve(blob);
          } else {
            reject(new Error('image'));
          }
        }, 'image/png');
      });
    }

    /**
     * Shares the result image natively when possible and otherwise downloads it.
     * @returns {Promise<void>} Resolves after sharing or downloading the PNG.
     */
    async function shareResultImage(){
      var button = document.getElementById('share-image-btn');
      var status = document.getElementById('share-status');
      button.disabled = true;
      status.textContent = 'Ergebnisgrafik wird erstellt …';
      try{
        var blob = await createResultImageBlob();
        var shareData = null;
        if(typeof File === 'function'){
          var file = new File([blob], 'carshare-ergebnis.png', { type: 'image/png' });
          shareData = { title: 'Auto oder Carsharing?', text: 'Mein persönlicher Kostenvergleich.', files: [file] };
        }
        if(shareData && typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare(shareData)){
          await navigator.share(shareData);
          status.textContent = 'Ergebnisgrafik geteilt.';
        } else {
          downloadBlob(blob, 'carshare-ergebnis.png');
          status.textContent = 'Ergebnisgrafik heruntergeladen.';
        }
      }catch(error){
        if(error && error.name === 'AbortError'){
          status.textContent = 'Teilen wurde abgebrochen.';
        } else {
          status.textContent = 'Die Ergebnisgrafik konnte nicht erstellt werden.';
        }
      }finally{
        button.disabled = false;
      }
    }

    return {
      encodeSharePayload: encodeSharePayload,
      decodeSharePayload: decodeSharePayload,
      createCompactShareState: createCompactShareState,
      expandCompactShareState: expandCompactShareState,
      loadSharedState: loadSharedState,
      createShareUrl: createShareUrl,
      shareCurrentState: shareCurrentState,
      shareResultImage: shareResultImage,
      createResultImageBlob: createResultImageBlob
    };
  }

  window.CarshareSharing = { create: create };
})();
