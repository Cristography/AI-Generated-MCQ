document.addEventListener('DOMContentLoaded', () => {
    const mainNav = document.getElementById('main-nav');
    const quizContainer = document.getElementById('quiz-container');
    const welcomeMessage = document.getElementById('welcome-message');
    const aiDisclaimer = document.getElementById('ai-disclaimer');

    // The universityStructure object is now loaded from structure.js
    // and is available here as a global variable.

    function buildNavigation() {
        for (const year in universityStructure) {
            const yearDropdown = document.createElement('div');
            yearDropdown.className = 'nav-dropdown';
            const yearButton = document.createElement('button');
            yearButton.innerHTML = `${year} <i class="fas fa-caret-down"></i>`;
            yearDropdown.appendChild(yearButton);
            const dropdownContent = document.createElement('div');
            dropdownContent.className = 'dropdown-content';
            const semesters = universityStructure[year];
            for (const semester in semesters) {
                const semesterHeader = document.createElement('div');
                semesterHeader.className = 'dropdown-header';
                semesterHeader.textContent = semester;
                dropdownContent.appendChild(semesterHeader);
                const courses = semesters[semester];
                courses.forEach(course => {
                    const courseLink = document.createElement('a');
                    courseLink.href = '#';
                    courseLink.textContent = course.name;
                    if (course.isPlaceholder) {
                        courseLink.classList.add('placeholder');
                        courseLink.addEventListener('click', (e) => {
                            e.preventDefault();
                            alert("This is a placeholder course. A quiz will be added soon!");
                        });
                    } else {
                        courseLink.addEventListener('click', (e) => {
                            e.preventDefault();
                            loadQuiz(course);
                            closeAllDropdowns();
                        });
                    }
                    dropdownContent.appendChild(courseLink);
                });
            }
            yearDropdown.appendChild(dropdownContent);
            mainNav.appendChild(yearDropdown);
            yearButton.addEventListener('click', (e) => {
                e.stopPropagation();
                const buttonRect = yearButton.getBoundingClientRect();
                const estimatedMenuWidth = 240;
                if (buttonRect.left + estimatedMenuWidth > window.innerWidth) {
                    dropdownContent.classList.add('align-right');
                } else {
                    dropdownContent.classList.remove('align-right');
                }
                const isActive = yearDropdown.classList.contains('active');
                closeAllDropdowns();
                if (!isActive) {
                    yearDropdown.classList.add('active');
                }
            });
        }
    }

    function closeAllDropdowns() {
        document.querySelectorAll('.nav-dropdown.active').forEach(d => d.classList.remove('active'));
    }

    window.addEventListener('click', (e) => {
        if (!e.target.closest('.nav-dropdown')) {
            closeAllDropdowns();
        }
    });

    async function loadQuiz(course) {
        const { file: filePath, isPlaceholder, name: courseName } = course;
        if (isPlaceholder) {
            alert("This is a placeholder course. A quiz will be added soon!");
            return;
        }
        welcomeMessage.style.display = 'none';
        aiDisclaimer.style.display = 'none';
        quizContainer.innerHTML = '<p>Loading quiz...</p>';
        try {
            const response = await fetch(filePath);
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}.`);
            const rawData = await response.json();
            let quizData;
            if (Array.isArray(rawData)) {
                quizData = { title: courseName, language: 'ar', questions: rawData };
            } else {
                quizData = rawData;
            }
            if (!quizData || !Array.isArray(quizData.questions)) {
                throw new Error(`Quiz file '${filePath}' is not in a recognized format.`);
            }

            aiDisclaimer.style.display = 'flex'; // Show the disclaimer
            quizContainer.classList.toggle('rtl', quizData.language === 'ar');
            renderQuiz(quizData, filePath);
        } catch (error) {
            quizContainer.classList.remove('rtl');
            console.error("Could not load quiz:", error);
            quizContainer.innerHTML = `<div class="question-block"><h3>Comming Soon</h3></div>`;
        }
    }

    function renderQuiz(quizData, filePath) {
        quizContainer.innerHTML = ''; // Clear loading message
        const quizHeader = document.createElement('div');
        quizHeader.id = 'quiz-header';
        quizHeader.innerHTML = `<h2>${quizData.title}</h2>`;
        const clearButton = document.createElement('button');
        clearButton.id = 'clear-storage-btn';
        clearButton.innerHTML = `<i class="fas fa-trash"></i> Clear Answers`;
        clearButton.onclick = () => {
            if (confirm("Are you sure you want to clear your saved answers for this quiz?")) {
                localStorage.removeItem(getStorageKey(filePath));
                const courseToReload = { file: filePath, name: quizData.title, isPlaceholder: false };
                loadQuiz(courseToReload);
            }
        };
        quizHeader.appendChild(clearButton);
        quizContainer.appendChild(quizHeader);
        const savedAnswers = getSavedAnswers(filePath);
        quizData.questions.forEach((q, index) => {
            // Pass filePath to createQuestionBlock for the report function
            const questionBlock = createQuestionBlock(q, index, filePath, quizData.title);
            quizContainer.appendChild(questionBlock);
            if (savedAnswers[index] !== undefined) {
                showResult(questionBlock, savedAnswers[index]);
            }
        });
    }

    function createQuestionBlock(q, index, filePath, courseName) {
        const questionBlock = document.createElement('div');
        questionBlock.className = 'question-block';
        questionBlock.dataset.questionIndex = index;

        const questionHeader = document.createElement('div');
        questionHeader.className = 'question-header';

        const questionTitle = document.createElement('h3');
        questionTitle.innerHTML = `${index + 1}. ${q.question}`;

        const reportButton = document.createElement('button');
        reportButton.className = 'report-btn';
        reportButton.innerHTML = `<i class="fas fa-flag"></i> Report`;
        reportButton.title = "Report an issue with this question";
        reportButton.onclick = () => handleReport(q, index, filePath, courseName);

        questionHeader.append(questionTitle, reportButton);

        const explanationText = document.createElement('div');
        explanationText.className = 'explanation-text';
        explanationText.innerHTML = `<p>${q.explanation}</p>`;

        const optionsList = document.createElement('ul');
        optionsList.className = 'options-list';
        optionsList.dataset.correctAnswerIndex = q.correctAnswerIndex;
        q.options.forEach((option, optionIndex) => {
            const optionItem = document.createElement('li');
            optionItem.className = 'option';
            optionItem.textContent = option;
            optionItem.dataset.index = optionIndex;
            optionItem.onclick = () => handleAnswer(optionItem, filePath);
            optionsList.appendChild(optionItem);
        });

        questionBlock.append(questionHeader, optionsList, explanationText);
        return questionBlock;
    }

    function handleReport(questionObject, qIndex, filePath, courseName) {
        const userNote = prompt("الرجاء وصف المشكلة في هذا السؤال (مثال: 'إجابة خاطئة'، 'خطأ إملائي'). سيتم إرسال هذه الرسالة إلى صاحب الموقع عبر تلغرام للمساعدة في تحسين المحتوى. شكراً لمساهمتكم!");

        if (userNote === null || userNote.trim() === "") { // User cancelled or entered nothing
            return;
        }

        const telegramUser = "Crsitography"; // Your Telegram username
        const questionText = questionObject.question;
        const optionsText = questionObject.options.map((opt, i) => `  ${i + 1}. ${opt}`).join('\n');
        const correctAnswer = questionObject.options[questionObject.correctAnswerIndex];

        // Using markdown for better formatting in Telegram
        const message = `
*--- Question Report ---*

*Course:* ${courseName}
*File Path:* \`${filePath}\`
*Question Index:* ${qIndex}

*Question:*
${questionText}

*Options:*
${optionsText}

*Marked Correct Answer:*
${correctAnswer}

*User's Note:*
${userNote}
        `;

        const encodedMessage = encodeURIComponent(message.trim());
        const telegramUrl = `https://t.me/${telegramUser}?text=${encodedMessage}`;

        window.open(telegramUrl, '_blank');
    }

    function handleAnswer(selectedOption, filePath) {
        const questionBlock = selectedOption.closest('.question-block');
        if (questionBlock.querySelector('.options-list').dataset.answered) return;
        const selectedAnswerIndex = parseInt(selectedOption.dataset.index);
        const questionIndex = parseInt(questionBlock.dataset.questionIndex);
        saveAnswer(filePath, questionIndex, selectedAnswerIndex);
        showResult(questionBlock, selectedAnswerIndex);
    }

    function showResult(questionBlock, selectedAnswerIndex) {
        const optionsList = questionBlock.querySelector('.options-list');
        optionsList.dataset.answered = 'true';
        const correctAnswerIndex = parseInt(optionsList.dataset.correctAnswerIndex);
        optionsList.children[correctAnswerIndex].classList.add('correct');
        if (selectedAnswerIndex !== correctAnswerIndex) {
            optionsList.children[selectedAnswerIndex].classList.add('incorrect');
        }
        Array.from(optionsList.children).forEach(option => {
            option.classList.add('disabled');
        });
        const explanationText = questionBlock.querySelector('.explanation-text');
        explanationText.classList.add('show');
    }

    const getStorageKey = (filePath) => `quiz_answers_${filePath}`;

    function saveAnswer(filePath, questionIndex, answerIndex) {
        const key = getStorageKey(filePath);
        const answers = getSavedAnswers(filePath);
        answers[questionIndex] = answerIndex;
        localStorage.setItem(key, JSON.stringify(answers));
    }

    function getSavedAnswers(filePath) {
        return JSON.parse(localStorage.getItem(getStorageKey(filePath)) || '{}');
    }

    buildNavigation();
});