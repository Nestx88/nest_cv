document.addEventListener('DOMContentLoaded', async () => {
    const languageToggleBtn = document.getElementById('language-toggle');
    const downloadPdfBtn = document.getElementById('download-pdf');
    let isEnglish = false;
    let isGenerating = false;
    let content = {};

    if (!languageToggleBtn || !downloadPdfBtn) {
        console.error('Brak przycisków:', { languageToggleBtn, downloadPdfBtn });
        alert('Brak jednego z przycisków w HTML!');
        return;
    }

    try {
        const response = await fetch('content.json');
        if (!response.ok) throw new Error('Nie udało się załadować content.json');
        content = await response.json();
        console.log('Content załadowany:', content);
    } catch (error) {
        console.error('Błąd ładowania treści:', error);
        alert('Wystąpił problem z załadowaniem treści!');
        return;
    }

    const updateContent = (lang) => {
        document.querySelectorAll('[data-lang-key]').forEach(el => {
            const key = el.dataset.langKey;
            let value;

            if (key.includes('.')) {
                const [listName, index, subKey] = key.split('.');
                if (content[lang][listName] && content[lang][listName][index]) {
                    value = subKey ? content[lang][listName][index][subKey] : content[lang][listName][index];
                }
            } else {
                value = content[lang][key];
            }

            if (value !== undefined) {
                if (el.tagName === 'H2' || el.tagName === 'H3') {
                    const icon = el.querySelector('i') ? `<i class="${el.querySelector('i').className}"></i>` : '';
                    el.innerHTML = `${icon} ${value}`;
                } else {
                    el.innerHTML = value;
                }
            }
        });
    };

    languageToggleBtn.addEventListener('click', () => {
        isEnglish = !isEnglish;
        const lang = isEnglish ? 'en' : 'pl';
        console.log(`Switching to ${lang} language`);
        updateContent(lang);
        languageToggleBtn.textContent = isEnglish ? 'EN/PL' : 'PL/EN';
    });

    const generatePdf = async () => {
        if (isGenerating) return;
        isGenerating = true;
        downloadPdfBtn.disabled = true;
        downloadPdfBtn.textContent = 'Generowanie...';

        const buttons = document.querySelector('.button-container');
        const footer = document.querySelector('.footer');
        if (buttons) buttons.style.display = 'none';
        if (footer) footer.style.display = 'none';

        // Tworzenie canvasa dla zdjęcia profilowego
        const imageCanvas = document.createElement('canvas');
        imageCanvas.width = 422;
        imageCanvas.height = 422;
        const imageCtx = imageCanvas.getContext('2d');

        const image = new Image();
        image.src = 'cv.jpeg';
        await new Promise((resolve, reject) => {
            image.onload = () => {
                console.log('Zdjęcie załadowane poprawnie');
                imageCtx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
                imageCtx.beginPath();
                imageCtx.arc(211, 211, 211, 0, Math.PI * 2);
                imageCtx.clip();
                imageCtx.drawImage(image, 0, 0, 422, 577);
                resolve();
            };
            image.onerror = () => {
                console.error('Błąd ładowania zdjęcia cv.jpeg');
                alert('Nie udało się załadować zdjęcia cv.jpeg!');
                reject();
            };
        });

        const container = document.querySelector('.container');
        if (!container) {
            console.error('Nie znaleziono kontenera do generowania PDF');
            return;
        }

        const canvas = await html2canvas(container, {
            scale: 4,
            useCORS: true,
            logging: true,
            backgroundColor: null, // Przezroczyste tło canvasa, aby szare tło PDF było widoczne
            imageSmoothingEnabled: true,
            onclone: (clonedDoc) => {
                const clonedImg = clonedDoc.querySelector('img[src="cv.jpeg"]') || clonedDoc.querySelector('img.profile-pic') || clonedDoc.querySelector('img');
                if (clonedImg) {
                    clonedImg.style.visibility = 'hidden';
                    console.log('Zdjęcie w HTML ukryte w klonie');
                }
            }
        });

        const { jsPDF } = window.jspdf;
        if (!jsPDF) throw new Error('jsPDF nie jest załadowany!');
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compression: 'NONE' });

        const pageWidth = doc.internal.pageSize.getWidth(); // 210 mm
        const pageHeight = doc.internal.pageSize.getHeight(); // 297 mm
        const canvasAspectRatio = canvas.width / canvas.height;
        const a4AspectRatio = pageWidth / pageHeight;

        let imgWidth, imgHeight;
        if (canvasAspectRatio > a4AspectRatio) {
            // Canvas szerszy niż A4 - dopasuj do szerokości
            imgWidth = pageWidth;
            imgHeight = pageWidth / canvasAspectRatio;
        } else {
            // Canvas wyższy lub równy A4 - dopasuj do wysokości
            imgHeight = pageHeight;
            imgWidth = pageHeight * canvasAspectRatio;
        }

        // Ustaw szare tło dla całej strony PDF
        doc.setFillColor(169, 169, 169); // Szary kolor (RGB 169, 169, 169)
        doc.rect(0, 0, pageWidth, pageHeight, 'F'); // Rysuj prostokąt wypełniający całą stronę

        // Dodaj canvas z treścią
        console.log('Zapisywanie canvasa do PDF', { canvasWidth: canvas.width, canvasHeight: canvas.height, imgWidth, imgHeight });
        doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight);

        // Dodaj zdjęcie wyśrodkowane w poziomie względem lewego panelu (ciemnoszare tło, 40% szerokości strony)
        const photoSize = 45; // Zmniejszenie zdjęcia z 50 mm na 45 mm
        const leftColumnWidth = pageWidth * 0.4; // 84 mm (40% szerokości strony)
        const photoX = (leftColumnWidth - photoSize) / 2; // Wyśrodkowanie w poziomie w obrębie lewego panelu
        const photoY = 52 - photoSize; // Dolna krawędź zdjęcia 52 mm od góry strony
        console.log('Dodawanie zdjęcia do PDF:', { photoX, photoY, photoSize });
        doc.addImage(imageCanvas.toDataURL('image/png'), 'PNG', photoX, photoY, photoSize, photoSize);

        // Dodaj okrąg wokół zdjęcia
        doc.setLineWidth(0.2); // Grubość linii ramki
        doc.setDrawColor(0, 0, 0); // Kolor ramki (czarny)
        doc.circle(photoX + photoSize / 2, photoY + photoSize / 2, photoSize / 2); // Rysowanie okręgu

        finalizePdf(doc);
    };

    const finalizePdf = (doc) => {
        const currentDate = new Date().toISOString().split('T')[0];
        const lang = isEnglish ? 'EN' : 'PL';
        const fileName = `Paweł Juszczyk - ${currentDate} - ${lang}.pdf`;

        doc.save(fileName);
        console.log('PDF wygenerowany:', fileName);

        const buttons = document.querySelector('.button-container');
        const footer = document.querySelector('.footer');
        if (buttons) buttons.style.display = '';
        if (footer) footer.style.display = '';

        isGenerating = false;
        downloadPdfBtn.disabled = false;
        downloadPdfBtn.textContent = 'Pobierz PDF';
    };

    downloadPdfBtn.addEventListener('click', generatePdf);
    updateContent('pl');
});