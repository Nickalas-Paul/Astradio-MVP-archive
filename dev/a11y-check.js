// Accessibility Check Script
// Run in browser console to check focus rings and landmarks

(function() {
  console.log('🔍 Running Atlas Accessibility Check...');
  
  // Check focus rings
  const focusables = 'a,button,input,select,textarea,[tabindex]';
  const elementsWithoutFocus = [];
  
  document.querySelectorAll(focusables).forEach(el => {
    const style = getComputedStyle(el);
    if (style.outlineStyle === 'none' && style.boxShadow === 'none') {
      elementsWithoutFocus.push(el);
    }
  });
  
  if (elementsWithoutFocus.length > 0) {
    console.warn(`⚠️ Found ${elementsWithoutFocus.length} focusable elements without visible focus rings:`);
    elementsWithoutFocus.forEach(el => {
      console.log(`- ${el.tagName}${el.className ? '.' + el.className.split(' ').join('.') : ''}`);
    });
    
    // Add temporary focus rings for debugging
    elementsWithoutFocus.forEach(el => {
      el.addEventListener('focus', () => {
        el.style.outline = '2px solid #0FA37F';
        el.style.outlineOffset = '2px';
      });
      el.addEventListener('blur', () => {
        el.style.outline = '';
        el.style.outlineOffset = '';
      });
    });
    console.log('✅ Added temporary focus rings for debugging');
  } else {
    console.log('✅ All focusable elements have visible focus rings');
  }
  
  // Check landmarks
  const landmarks = {
    'main': document.querySelector('main'),
    'nav': document.querySelector('nav'),
    'header': document.querySelector('header'),
    'footer': document.querySelector('footer'),
    'aside': document.querySelector('aside')
  };
  
  console.log('🏗️ Landmark elements:');
  Object.entries(landmarks).forEach(([name, element]) => {
    if (element) {
      console.log(`✅ ${name}: found`);
    } else {
      console.log(`❌ ${name}: missing`);
    }
  });
  
  // Check heading hierarchy
  const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
  const headingLevels = Array.from(headings).map(h => parseInt(h.tagName[1]));
  
  let hierarchyIssues = 0;
  for (let i = 1; i < headingLevels.length; i++) {
    if (headingLevels[i] > headingLevels[i-1] + 1) {
      hierarchyIssues++;
    }
  }
  
  if (hierarchyIssues > 0) {
    console.warn(`⚠️ Found ${hierarchyIssues} heading hierarchy issues`);
  } else {
    console.log('✅ Heading hierarchy is correct');
  }
  
  // Check alt text for images
  const images = document.querySelectorAll('img');
  const imagesWithoutAlt = Array.from(images).filter(img => !img.alt);
  
  if (imagesWithoutAlt.length > 0) {
    console.warn(`⚠️ Found ${imagesWithoutAlt.length} images without alt text:`);
    imagesWithoutAlt.forEach(img => {
      console.log(`- ${img.src || 'inline image'}`);
    });
  } else {
    console.log('✅ All images have alt text');
  }
  
  // Check color contrast (basic check)
  const textElements = document.querySelectorAll('p, span, div, h1, h2, h3, h4, h5, h6, a, button');
  let contrastIssues = 0;
  
  textElements.forEach(el => {
    const style = getComputedStyle(el);
    const color = style.color;
    const backgroundColor = style.backgroundColor;
    
    // Basic check for transparent or same colors
    if (color === backgroundColor || color === 'rgba(0, 0, 0, 0)' || backgroundColor === 'rgba(0, 0, 0, 0)') {
      contrastIssues++;
    }
  });
  
  if (contrastIssues > 0) {
    console.warn(`⚠️ Found ${contrastIssues} potential color contrast issues`);
  } else {
    console.log('✅ No obvious color contrast issues found');
  }
  
  // Check ARIA labels
  const interactiveElements = document.querySelectorAll('button, a, input, select, textarea');
  const elementsWithoutLabels = Array.from(interactiveElements).filter(el => {
    return !el.getAttribute('aria-label') && 
           !el.getAttribute('aria-labelledby') && 
           !el.textContent?.trim() && 
           !el.getAttribute('title');
  });
  
  if (elementsWithoutLabels.length > 0) {
    console.warn(`⚠️ Found ${elementsWithoutLabels.length} interactive elements without accessible labels:`);
    elementsWithoutLabels.forEach(el => {
      console.log(`- ${el.tagName}${el.className ? '.' + el.className.split(' ').join('.') : ''}`);
    });
  } else {
    console.log('✅ All interactive elements have accessible labels');
  }
  
  console.log('🎯 Accessibility check complete!');
  console.log('💡 Use Tab key to test keyboard navigation');
  console.log('💡 Use screen reader to test semantic structure');
})();
