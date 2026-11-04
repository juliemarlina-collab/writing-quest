/* ==========================================================================
   Crystal Quest 4: Write & Win - GAME DATA (edit this file to change content)
   --------------------------------------------------------------------------
   HEROES : the 4 playable heroes.
   WORLDS : the 3 levels (10, 11, 12). Each has 3 Writing Sessions in `challenges`.
   MOCK   : the 75-minute full mock paper (Task 1 + Task 2).
   ========================================================================== */
window.CQ_DATA = (function () {
  'use strict';
  const HEROES = [
    {
      id: 'aiden',
      name: 'Aiden',
      title: 'The Young Adventurer',
      portrait: 'art/portrait_aiden.jpg',
      traits: 'Brave, enthusiastic & adventurous',
      effectLabel: 'Golden Sparkles ✨',
      colors: {
        hair: 0x5c3317,
        tunic: 0x2563eb,
        accent: 0xef4444,
        skin: 0xffe0bd,
        boots: 0x78350f,
        particle: 0xfbbf24,
        eyeColor: '#1e3a8a'
      }
    },
    {
      id: 'luna',
      name: 'Luna',
      title: 'The Forest Mage',
      portrait: 'art/portrait_luna.jpg',
      traits: 'Curious, intelligent & cheerful',
      effectLabel: 'Purple Magic Particles 🔮',
      colors: {
        hair: 0xf472b6,
        tunic: 0x7e22ce,
        accent: 0xfacc15,
        skin: 0xffe4c8,
        boots: 0x581c87,
        particle: 0xc084fc,
        eyeColor: '#6b21a8'
      }
    },
    {
      id: 'rex',
      name: 'Rex',
      title: 'The Scout Ranger',
      portrait: 'art/portrait_rex.jpg',
      traits: 'Energetic, resourceful & observant',
      effectLabel: 'Green Leaf Particles 🍃',
      colors: {
        hair: 0xfbbf24,
        tunic: 0x16a34a,
        accent: 0x854d0e,
        skin: 0xffe0bd,
        boots: 0x422006,
        particle: 0x4ade80,
        eyeColor: '#14532d'
      }
    },
    {
      id: 'mia',
      name: 'Mia',
      title: 'The Crystal Explorer',
      portrait: 'art/portrait_mia.jpg',
      traits: 'Confident, friendly & determined',
      effectLabel: 'Blue & Gold Crystal Particles 💎',
      colors: {
        hair: 0x451a03,
        tunic: 0xeab308,
        accent: 0x9333ea,
        skin: 0xffe0bd,
        boots: 0x5b21b6,
        particle: 0x38bdf8,
        eyeColor: '#7c2d12'
      }
    }
  ];

  /* ------------------------------------------------------------------------
     Each Writing Session = one task with Quilla the Fox Scribe.
       type : 'sort'   - choose from fixed buttons (e.g. Formal / Informal / Too casual)
              'mcq'    - 3-option questions (shuffled)
              'gapped' - sentences A-G fill gaps [1]-[6]
              'write'  - the student writes (Task 1 email or Task 2 essay), then
                         tags their own sentences (notes / PEEL parts) and self-checks
       texts     : guide cards / the task shown on the left (paras: paragraphs)
       questions : as in the reading game (q, choices, correct, skill, hint, evidence)
       write tasks:
         rubric      : the MUET-style instruction
         stimulus    : { label, paras } the email / statement students respond to
         notes       : Task 1 notes (shown as pins)
         minWords    : at least 100 (Task 1) / 250 (Task 2)
         examMinutes : time used when the student turns on Exam timing
         tags        : what the student must find in their own writing (id, label)
         checks      : quality ticks (the student decides)
         frames      : sentence frames that can be inserted (not full answers)
         model       : model answer (paras) + which sentence shows each tag
                       (opens only after the student has written and checked)
     ------------------------------------------------------------------------ */
  const WORLDS = [
    {
      id: 1,
      level: 10,
      name: 'Inkleaf Village',
      subtitle: 'Level 10 • MUET Writing Task 1 • Informal email (100+ words)',
      thumb: 'art/card_w1.webp',
      objectiveDesc: 'Pick the right tone, read the task carefully, then reply to a friend using all the notes.',
      skyColor: 0xc4a5f5,
      fogColor: 0xdcc7f7,
      waterColor: 0x4f46e5,
      groundColor: 0x74b356,
      platformColor: 0xc9a46a,
      crystalColor: 0xfbbf24,
      portalColor: 0xa855f7,
      totalCoins: 20,
      totalChests: 1,
      chestIndices: [1],
      challenges: [
        {
          id: 'L10-A1',
          part: 'Task 1',
          type: 'sort',
          title: 'Pitch It Right: Formal or Informal?',
          guardian: 'Quilla the Fox Scribe',
          time: 'about 4 minutes',
          instructions: 'Read the tone guide. Then decide: is each phrase formal, informal, or too casual for MUET?',
          choices: ['Formal (lecturer / officer)', 'Informal (friend / classmate)', 'Too casual for MUET'],
          texts: [
            {
              label: 'Guide',
              title: 'Who is reading my email?',
              paras: [
                'A friend or classmate: write in an informal but polite tone. A lecturer, officer, manager or organiser: write in a formal tone.',
                'Informal openings and closings: "Hi Danial," or "Dear Aina," and "Take care," or "See you soon,". Friendly phrases such as "Thanks a lot for your email!" suit a friend.',
                'Formal openings and closings: "Dear Encik Rahman," or "Dear Sir or Madam," and "Yours sincerely," or "Thank you for your time." Formal emails state the purpose clearly: "I am writing to..." and use polite requests: "I would like to...", "Could you please...".',
                'Informal does not mean slang. In MUET, avoid "gonna", "wanna", "u", "lol" and emojis, even when you write to a friend.'
              ]
            }
          ],
          questions: [
            { q: '"Dear Encik Rahman,"', correct: 0, skill: 'Register', hint: 'Encik Rahman is an officer. Look at the formal openings.', evidence: '"Dear Encik Rahman,"' },
            { q: '"Hi Danial,"', correct: 1, skill: 'Register', hint: 'Danial is your classmate.', evidence: '"Hi Danial,"' },
            { q: '"Gonna tell you everything later!"', correct: 2, skill: 'Register', hint: 'Look at the last paragraph of the guide.', evidence: 'avoid "gonna", "wanna", "u", "lol" and emojis' },
            { q: '"I am writing to enquire about the volunteer programme."', correct: 0, skill: 'Register', hint: 'How do formal emails state the purpose?', evidence: '"I am writing to..."' },
            { q: '"Thanks a lot for your email!"', correct: 1, skill: 'Register', hint: 'Is this friendly or official?', evidence: 'Friendly phrases such as "Thanks a lot for your email!" suit a friend.' },
            { q: '"Could you please send me the schedule?"', correct: 0, skill: 'Register', hint: 'This is a polite request.', evidence: '"Could you please..."' },
            { q: '"u know what i mean lol"', correct: 2, skill: 'Register', hint: 'Would an examiner accept "u" and "lol"?', evidence: 'avoid "gonna", "wanna", "u", "lol" and emojis' },
            { q: '"Yours sincerely,"', correct: 0, skill: 'Register', hint: 'Look at the formal closings.', evidence: '"Yours sincerely,"' }
          ]
        },
        {
          id: 'L10-A2',
          part: 'Task 1',
          type: 'mcq',
          title: 'Read the Task & Fix Siti’s Draft',
          guardian: 'Quilla the Fox Scribe',
          time: 'about 6 minutes',
          instructions: 'Before you write, read the task carefully. Then help Siti fix the mistakes in her first draft.',
          texts: [
            {
              label: 'Task',
              title: 'Email from Danial (your classmate)',
              paras: [
                'Hi! I heard you’re taking MUET next session. I’m sitting for it too, but I’m really nervous, especially about Speaking. How are you preparing? Do you think we could study together? Let me know!',
                'Notes: ① Nervous: say how you feel ② Preparation: describe your plan ③ Speaking: one tip ④ Study together: when & where'
              ]
            },
            {
              label: 'Draft',
              title: 'Siti’s first draft',
              paras: [
                'Hi Danial,\nThank for you email. I very nervous about Speaking too. I am agree that we should study together. We can meet in Tuesday at the library.\nTake care,\nSiti'
              ]
            }
          ],
          questions: [
            {
              q: 'Who will read your reply, and what tone should you use?',
              choices: ['Danial, a classmate: friendly and polite, with no slang', 'An examiner: very formal, like a report', 'Danial, a classmate: casual chat words like "lol"'],
              correct: 0, skill: 'Reading the task',
              hint: 'The email starts "Hi!" and Danial is your classmate.',
              evidence: 'Hi! I heard you\u2019re taking MUET next session.'
            },
            {
              q: 'Note ③ says "Speaking: one tip". What must you write?',
              choices: ['Give Danial one useful tip for the Speaking test', 'Say that you are good at speaking', 'Ask Danial to give you a tip'],
              correct: 0, skill: 'Reading the task',
              hint: 'Danial is nervous about Speaking. What would help him?',
              evidence: '③ Speaking: one tip'
            },
            {
              q: 'Which sentence covers note ④ (study together: when & where) best?',
              choices: ['Shall we meet at the library every Tuesday at 4 p.m.?', 'Yes, let’s study together.', 'Studying is very important for MUET.'],
              correct: 0, skill: 'Developing a note',
              hint: 'The note asks for two details: when AND where.',
              evidence: '④ Study together: when & where'
            },
            {
              q: 'Fix the first mistake: "Thank for you email."',
              choices: ['Thank you for your email.', 'Thanks for you email.', 'Thank for your emails.'],
              correct: 0, skill: 'Grammar accuracy',
              hint: 'Two small words are wrong.',
              evidence: 'Thank for you email.'
            },
            {
              q: 'Fix: "I very nervous about Speaking too."',
              choices: ['I am very nervous about Speaking too.', 'I very am nervous about Speaking too.', 'I very nervously about Speaking too.'],
              correct: 0, skill: 'Grammar accuracy',
              hint: 'The sentence is missing its verb.',
              evidence: 'I very nervous about Speaking too.'
            },
            {
              q: 'Fix: "I am agree that we should study together."',
              choices: ['I agree that we should study together.', 'I am agreed that we should study together.', 'I agreeing that we should study together.'],
              correct: 0, skill: 'Grammar accuracy',
              hint: '"Agree" is already a verb.',
              evidence: 'I am agree that we should study together.'
            },
            {
              q: 'Fix: "We can meet in Tuesday at the library."',
              choices: ['We can meet on Tuesday at the library.', 'We can meet at Tuesday in the library.', 'We can meet in the Tuesday at library.'],
              correct: 0, skill: 'Grammar accuracy',
              hint: 'Which preposition goes with days of the week?',
              evidence: 'We can meet in Tuesday at the library.'
            }
          ]
        },
        {
          id: 'L10-A3',
          part: 'Task 1',
          type: 'write',
          title: 'Reply to Danial',
          guardian: 'Quilla the Fox Scribe',
          time: '25 minutes in the exam',
          examMinutes: 25,
          skill: 'Task 1: informal email',
          instructions: 'Write your reply. Then show where you covered each note and check your work.',
          rubric: 'You received an email from your classmate, Danial. Read his email and the notes. Write a reply of at least 100 words, using all the notes given.',
          stimulus: {
            label: 'Email from Danial',
            paras: [
              'Hi! I heard you’re taking MUET next session. I’m sitting for it too, but I’m really nervous, especially about Speaking. How are you preparing? Do you think we could study together? Let me know!'
            ]
          },
          notes: ['Nervous: say how you feel', 'Preparation: describe your plan', 'Speaking: give one tip', 'Study together: when & where'],
          minWords: 100,
          tags: [
            { id: 'open', label: 'Greeting & opening line' },
            { id: 'n1', label: 'Note ① How I feel' },
            { id: 'n2', label: 'Note ② My plan' },
            { id: 'n3', label: 'Note ③ Speaking tip' },
            { id: 'n4', label: 'Note ④ When & where' },
            { id: 'close', label: 'Closing' }
          ],
          checks: [
            'My tone is friendly and polite, with no slang (no "gonna", "u", "lol")',
            'I developed each note with a detail or reason, not just one word',
            'I checked my grammar and spelling (e.g. "on Tuesday", "I agree")'
          ],
          frames: [
            'Hi Danial,\nThanks for your email. ',
            'Honestly, I feel ___ too, especially when ___. ',
            'To prepare, I am ___ every ___. I also plan to ___. ',
            'For Speaking, my tip is to ___. This helps because ___. ',
            'I would love to study together. Shall we meet at ___ on ___ at ___? ',
            'Let me know if you are free.\nTake care,\n___'
          ],
          model: {
            paras: [
              'Hi Danial,',
              'Thanks for your email. Honestly, I feel nervous too, especially when I have to speak without much preparation. However, I think regular practice will help us feel more confident.',
              'I am preparing by reviewing one MUET component each evening and keeping a notebook of my common mistakes. At weekends, I plan to try a longer practice task.',
              'For Speaking, my advice is to use PREP: state your point, give a reason, add an example and return to your point.',
              'I would love to study together. Shall we meet at the library every Tuesday at four in the afternoon? We could invite Aina and Hakim to practise a group discussion. Let me know if you are free.',
              'Take care,\nSiti'
            ],
            marks: {
              open: 'Thanks for your email.',
              n1: 'Honestly, I feel nervous too, especially when I have to speak without much preparation.',
              n2: 'I am preparing by reviewing one MUET component each evening and keeping a notebook of my common mistakes.',
              n3: 'For Speaking, my advice is to use PREP: state your point, give a reason, add an example and return to your point.',
              n4: 'Shall we meet at the library every Tuesday at four in the afternoon?',
              close: 'Let me know if you are free.'
            }
          },
          questions: []
        }
      ]
    },
    {
      id: 2,
      level: 11,
      name: 'Courier Citadel',
      subtitle: 'Level 11 • MUET Writing Task 1 • Formal email (100+ words)',
      thumb: 'art/card_w2.webp',
      objectiveDesc: 'Upgrade casual phrases, build a formal email, then write to an officer using all the notes.',
      skyColor: 0x7dd3fc,
      fogColor: 0xbfe3fb,
      waterColor: 0x2563eb,
      groundColor: 0x7cc56a,
      platformColor: 0xd6c7ef,
      crystalColor: 0xfbbf24,
      portalColor: 0x06b6d4,
      totalCoins: 30,
      totalChests: 2,
      chestIndices: [0, 2],
      challenges: [
        {
          id: 'L11-A1',
          part: 'Task 1',
          type: 'mcq',
          title: 'Upgrade to Formal',
          guardian: 'Quilla the Fox Scribe',
          time: 'about 5 minutes',
          instructions: 'You are writing to Puan Rahmah, the Student Affairs Officer. Choose the best formal version of each phrase.',
          texts: [
            {
              label: 'Guide',
              title: 'The shape of a formal email',
              paras: [
                'Greeting: use a title and name, for example "Dear Puan Rahmah,". If you do not know the name, write "Dear Sir or Madam,".',
                'Opening line: thank the reader or state your purpose, for example "Thank you for your email about...".',
                'Body: write one short paragraph for each note. Use full forms (I am, I cannot) instead of contractions, and polite requests such as "Could you please...?"',
                'Closing: say what you would like to happen next and end politely, for example "I look forward to hearing from you." Then "Yours sincerely," and your full name.'
              ]
            }
          ],
          questions: [
            { q: 'Greeting: "Hi there!"', choices: ['Dear Puan Rahmah,', 'Hey Puan!', 'To whoever is reading,'], correct: 0, skill: 'Formal register', hint: 'Use a title and the name.', evidence: 'use a title and name, for example "Dear Puan Rahmah,"' },
            { q: '"I wanna join your programme."', choices: ['I would like to take part in the programme.', 'I really wanna join it.', 'Me want join programme.'], correct: 0, skill: 'Formal register', hint: 'Avoid "wanna". Use a polite, full form.', evidence: 'Use full forms (I am, I cannot) instead of contractions' },
            { q: '"Send me the details ASAP."', choices: ['Could you please send me the details by Friday?', 'Send details now, thanks.', 'Details please ASAP!!'], correct: 0, skill: 'Polite requests', hint: 'Turn the order into a polite request.', evidence: 'polite requests such as "Could you please...?"' },
            { q: '"Can’t make it on Saturday, sorry."', choices: ['Unfortunately, I am unable to attend on Saturday.', 'Can’t come lah, sorry.', 'Saturday cannot.'], correct: 0, skill: 'Formal register', hint: 'Use full forms and a polite word like "Unfortunately".', evidence: 'Use full forms (I am, I cannot) instead of contractions' },
            { q: 'Best opening line for a reply to Puan Rahmah:', choices: ['Thank you for your email about the beach clean-up programme.', 'Got your email.', 'Hello, how are you, I hope you are fine and happy and healthy.'], correct: 0, skill: 'Opening & closing', hint: 'Thank the reader or state your purpose.', evidence: 'thank the reader or state your purpose' },
            { q: 'Best way to end the email:', choices: ['I look forward to hearing from you. Yours sincerely, Aiman bin Hakim', 'Bye! :)', 'That’s all. Aiman'], correct: 0, skill: 'Opening & closing', hint: 'Say what happens next, then a formal sign-off and your full name.', evidence: '"I look forward to hearing from you." Then "Yours sincerely," and your full name' }
          ]
        },
        {
          id: 'L11-A2',
          part: 'Task 1',
          type: 'gapped',
          title: 'Build a Formal Email',
          guardian: 'Quilla the Fox Scribe',
          time: 'about 6 minutes',
          instructions: 'Encik Faizal invited students to help at the Polytechnic English Week. Put the missing sentences (A–G) back into Nadia’s reply. One sentence does not fit.',
          texts: [
            {
              label: '',
              title: 'Nadia’s reply to Encik Faizal',
              paras: [
                'Dear Encik Faizal,',
                '[1] I would be delighted to join the committee for the Polytechnic English Week next month.',
                'I am interested in this role because I enjoy organising events. [2]',
                'As for activities, I would like to suggest a spelling bee for first-year students. [3]',
                'However, I have one question. [4] I have classes until 3 p.m. on most days.',
                '[5] I can also design posters and manage the event’s Instagram page.',
                '[6]',
                'Yours sincerely,\nNadia binti Azman (DEP3A)'
              ]
            }
          ],
          options: [
            'Thank you for your email inviting students to help with the event.',
            'Last semester, I helped to run our department’s Hari Inovasi, so I have some experience.',
            'It would be fun and would help students learn new words.',
            'Could you please tell me what time the committee meetings will be held?',
            'Finally, I would be happy to help in other ways.',
            'I look forward to hearing from you.',
            'Anyway, see ya at the meeting, it’s gonna be awesome!'
          ],
          questions: [
            { gap: 1, correct: 0, skill: 'Email structure', hint: 'A formal email often opens by thanking the reader.', evidence: 'Dear Encik Faizal,' },
            { gap: 2, correct: 1, skill: 'Developing a note', hint: 'The writer says why she is interested. Which sentence gives evidence?', evidence: 'I am interested in this role because I enjoy organising events.' },
            { gap: 3, correct: 2, skill: 'Developing a note', hint: 'Which sentence explains why the spelling bee is a good idea?', evidence: 'I would like to suggest a spelling bee for first-year students.' },
            { gap: 4, correct: 3, skill: 'Polite requests', hint: '"I have one question." What comes next?', evidence: 'However, I have one question.' },
            { gap: 5, correct: 4, skill: 'Cohesion', hint: 'The next sentence says "also". Which sentence introduces more help?', evidence: 'I can also design posters' },
            { gap: 6, correct: 5, skill: 'Email structure', hint: 'This line comes just before "Yours sincerely,".', evidence: 'Yours sincerely,' }
          ]
        },
        {
          id: 'L11-A3',
          part: 'Task 1',
          type: 'write',
          title: 'Write to Puan Rahmah',
          guardian: 'Quilla the Fox Scribe',
          time: '25 minutes in the exam',
          examMinutes: 25,
          skill: 'Task 1: formal email',
          instructions: 'Write your formal reply. Then show where you covered each note and check your work.',
          rubric: 'You received an email from Puan Rahmah, the Student Affairs Officer at your polytechnic. Read her email and the notes. Write a reply of at least 100 words, using all the notes given.',
          stimulus: {
            label: 'Email from Puan Rahmah (Student Affairs Officer)',
            paras: [
              'Dear students,',
              'The Student Affairs Unit is organising a Beach Clean-Up at Teluk Kemang, Port Dickson, on Saturday, 14 December, from 8 a.m. to 12 noon. We are looking for student volunteers to help us. If you are interested, please reply to this email.',
              'Regards,\nPuan Rahmah\nStudent Affairs Officer'
            ]
          },
          notes: ['Interested: why', 'Suggest one activity', 'Ask: transport?', 'Offer: how you can help'],
          minWords: 100,
          tags: [
            { id: 'open', label: 'Formal greeting & opening' },
            { id: 'n1', label: 'Note ① Why I am interested' },
            { id: 'n2', label: 'Note ② My suggestion' },
            { id: 'n3', label: 'Note ③ Transport question' },
            { id: 'n4', label: 'Note ④ How I can help' },
            { id: 'close', label: 'Formal closing & full name' }
          ],
          checks: [
            'My tone is formal: no contractions, slang or emojis',
            'I developed each note with a reason or detail',
            'I used polite requests ("Could you please...?") and checked my grammar and spelling'
          ],
          frames: [
            'Dear Puan Rahmah,\nThank you for your email about ___. ',
            'I would like to volunteer because ___. ',
            'I would also like to suggest ___. This would ___. ',
            'Could you please tell me whether ___? ',
            'In addition, I would be happy to ___. ',
            'I look forward to hearing from you.\nYours sincerely,\n___ (full name, class)'
          ],
          model: {
            paras: [
              'Dear Puan Rahmah,',
              'Thank you for your email about the Beach Clean-Up at Teluk Kemang. I would like to volunteer for this programme.',
              'I am interested because I care about the environment, and I am sad to see plastic waste on our beaches every weekend. I believe a small effort from students can make a big difference.',
              'I would also like to suggest a short recycling talk for visitors before we start. This would remind the public not to leave rubbish behind.',
              'Could you please tell me whether transport will be provided from the polytechnic? Many students do not have their own vehicles.',
              'In addition, I would be happy to design a poster for the event and encourage my classmates to join.',
              'I look forward to hearing from you.',
              'Yours sincerely,\nAiman bin Hakim (DUE50132, Semester 3)'
            ],
            marks: {
              open: 'Thank you for your email about the Beach Clean-Up at Teluk Kemang.',
              n1: 'I am interested because I care about the environment, and I am sad to see plastic waste on our beaches every weekend.',
              n2: 'I would also like to suggest a short recycling talk for visitors before we start.',
              n3: 'Could you please tell me whether transport will be provided from the polytechnic?',
              n4: 'In addition, I would be happy to design a poster for the event and encourage my classmates to join.',
              close: 'I look forward to hearing from you.'
            }
          },
          questions: []
        }
      ]
    },
    {
      id: 3,
      level: 12,
      name: 'Spellwright’s Forge',
      subtitle: 'Level 12 • MUET Writing Task 2 • Essay (250+ words) & the Golem',
      thumb: 'art/card_w3.webp',
      objectiveDesc: 'Know the essay types, build intro + PEEL + conclusion, then write a full essay to free the Writer’s Block Golem.',
      skyColor: 0x6d28d9,
      fogColor: 0xa78bfa,
      waterColor: 0x4c1d95,
      groundColor: 0x6cbd4a,
      platformColor: 0xb7a6e6,
      crystalColor: 0xe879f9,
      portalColor: 0xc084fc,
      totalCoins: 30,
      totalChests: 2,
      chestIndices: [0, 1],
      challenges: [
        {
          id: 'L12-A1',
          part: 'Task 2',
          type: 'mcq',
          title: 'Know Your Essay',
          guardian: 'Quilla the Fox Scribe',
          time: 'about 6 minutes',
          instructions: 'Read the Task 2 guide, then answer the questions.',
          texts: [
            {
              label: 'Guide',
              title: 'MUET Task 2: the extended essay (250+ words)',
              paras: [
                'Three common essay types: an argumentative essay takes one clear side and defends it; a discursive essay discusses both sides and then gives your judgement; a problem-solution essay explains the causes of a problem and suggests solutions.',
                'Introduction: start with some background, rewrite the question in your own words, and state your stand clearly (your thesis).',
                'Body paragraphs: use PEEL. Point (one clear idea), Explain (why or how it is true), Example (a real, specific case), Link (connect back to the question).',
                'Conclusion: restate your stand and sum up your main points. Do not add new ideas.'
              ]
            }
          ],
          questions: [
            { q: '"Many students find it hard to manage their time. What are the causes of this problem, and what can be done?" What type of essay is this?', choices: ['Problem-solution', 'Argumentative', 'Discursive'], correct: 0, skill: 'Essay types', hint: 'The question asks for causes and what can be done.', evidence: 'a problem-solution essay explains the causes of a problem and suggests solutions' },
            { q: '"Community service should be compulsory for all polytechnic students. Do you agree?" What type of essay is this?', choices: ['Argumentative', 'Problem-solution', 'A story'], correct: 0, skill: 'Essay types', hint: '"Do you agree?" asks you to take a side.', evidence: 'an argumentative essay takes one clear side and defends it' },
            { q: '"Online learning has advantages and disadvantages. Discuss both views and give your opinion." What type of essay is this?', choices: ['Discursive', 'Problem-solution', 'Argumentative with one side only'], correct: 0, skill: 'Essay types', hint: 'It asks for both views, then your opinion.', evidence: 'a discursive essay discusses both sides and then gives your judgement' },
            { q: 'Which sentence is the clearest thesis statement?', choices: ['I partly agree: social media helps students learn, but it does more harm when it is used without limits.', 'Social media is a thing that many people use.', 'In this essay, I will write about social media.'], correct: 0, skill: 'Thesis & stand', hint: 'A thesis states your stand.', evidence: 'state your stand clearly (your thesis)' },
            { q: 'In PEEL, what does the second E stand for?', choices: ['Example: a real, specific case', 'Ending: the last sentence', 'Explain again in other words'], correct: 0, skill: 'PEEL', hint: 'Point, Explain, ___, Link.', evidence: 'Example (a real, specific case)' },
            { q: 'What should a conclusion do?', choices: ['Restate your stand and sum up your main points', 'Introduce a brand-new argument', 'Tell a long story about yourself'], correct: 0, skill: 'Essay structure', hint: 'Read the last line of the guide.', evidence: 'restate your stand and sum up your main points. Do not add new ideas.' }
          ]
        },
        {
          id: 'L12-A2',
          part: 'Task 2',
          type: 'gapped',
          title: 'Forge the PEEL Runes',
          guardian: 'Quilla the Fox Scribe',
          time: 'about 7 minutes',
          instructions: 'Put the missing sentences (A–G) back into this short essay plan. Watch the colours: thesis, Point, Explain, Example, Link and conclusion. One sentence does not fit.',
          texts: [
            {
              label: '',
              title: 'Should polytechnics make community service compulsory?',
              paras: [
                'Introduction: Many polytechnics encourage students to join community projects, but only a few make them compulsory. [1]',
                'Body paragraph: [2] [3] For instance, students who joined the Port Dickson Beach Clean-Up last year had to plan routes, manage volunteers and talk to the public. [4]',
                'Second body paragraph (in brief): Community service also connects students with the people they will serve in their future careers.',
                'Conclusion: [5] [6]'
              ]
            }
          ],
          options: [
            'In my opinion, community service should be compulsory because it builds skills and character.',
            'First and foremost, community service develops important workplace skills.',
            'This is because students must plan, communicate and solve real problems outside the classroom.',
            'Therefore, compulsory community service prepares students for the working world.',
            'In conclusion, I strongly believe that community service should be part of every student’s programme.',
            'It helps students gain skills and become more caring members of society.',
            'Also, my favourite food at the beach is ice cream.'
          ],
          questions: [
            { gap: 1, correct: 0, skill: 'Thesis & stand', hint: 'The introduction must end with the writer’s stand.', evidence: 'but only a few make them compulsory' },
            { gap: 2, correct: 1, skill: 'PEEL: Point', hint: 'A body paragraph starts with a clear Point (topic sentence).', evidence: 'Body paragraph:' },
            { gap: 3, correct: 2, skill: 'PEEL: Explain', hint: 'After the Point comes the Explanation: why or how?', evidence: 'For instance, students who joined' },
            { gap: 4, correct: 3, skill: 'PEEL: Link', hint: 'After the Example, link back to the question.', evidence: 'had to plan routes, manage volunteers and talk to the public' },
            { gap: 5, correct: 4, skill: 'Conclusion', hint: 'Restate the stand with a concluding phrase.', evidence: 'Conclusion:' },
            { gap: 6, correct: 5, skill: 'Conclusion', hint: 'Sum up the main points, with no new idea.', evidence: 'Conclusion:' }
          ]
        },
        {
          id: 'L12-A3',
          part: 'Task 2',
          type: 'write',
          boss: true,
          title: 'The Golem’s Challenge: Your Essay',
          guardian: 'Quilla the Fox Scribe',
          time: '50 minutes in the exam',
          examMinutes: 50,
          skill: 'Task 2: extended essay',
          instructions: 'The Writer’s Block Golem guards the last writing session. Write your essay to free it. Then show your structure and check your work.',
          rubric: 'Write an essay of at least 250 words on the topic below. Support your answer with reasons and examples.',
          stimulus: {
            label: 'Essay topic',
            paras: [
              'Social media is now part of every student’s life. Some people believe that it does more harm than good to students. Do you agree? Give your opinion with reasons and examples.'
            ]
          },
          notes: [],
          minWords: 250,
          tags: [
            { id: 'stand', label: 'Intro: my stand (thesis)' },
            { id: 'point', label: 'Point (topic sentence)' },
            { id: 'explain', label: 'Explain' },
            { id: 'example', label: 'Example' },
            { id: 'link', label: 'Link back' },
            { id: 'concl', label: 'Conclusion' }
          ],
          checks: [
            'I wrote an introduction, at least two body paragraphs and a conclusion',
            'Each body paragraph has one clear point with an explanation and a real example',
            'I used linkers (Firstly, Furthermore, However, Therefore, In conclusion) and checked my grammar'
          ],
          frames: [
            'Today, ___. Some people believe that ___. In my opinion, ___ because ___.\n\n',
            'First and foremost, ___. This is because ___. For instance, ___. Therefore, ___.\n\n',
            'Furthermore, ___. This happens because ___. For example, ___. As a result, ___.\n\n',
            'However, some people argue that ___. Although this is true, ___.\n\n',
            'In conclusion, I believe that ___ because ___ and ___. Students should ___.'
          ],
          model: {
            paras: [
              'Social media apps such as TikTok and Instagram are now a daily habit for most students. While these platforms help students share information, I partly agree that social media does more harm than good when it is used without limits.',
              'First and foremost, social media distracts students from their studies and their sleep. This is because apps are designed to keep users scrolling, so a short break can easily become two hours. For instance, many students check their phones late at night and then struggle to concentrate in an 8 a.m. class. Therefore, uncontrolled use can lower students’ academic performance.',
              'Furthermore, social media can harm students’ mental health. Students often compare their own lives with the perfect pictures they see online. For example, a student may feel that everyone else is more successful or attractive, which can lead to anxiety and low self-esteem. Some students even stop sharing their ideas in class because they are afraid of being judged. As a result, social media can affect how students feel about themselves.',
              'However, social media also has benefits. Many students use WhatsApp study groups or YouTube tutorials to revise difficult topics, and lecturers often share notes and announcements online. Although this is true, these benefits only appear when students use social media purposefully and for limited periods.',
              'In conclusion, I believe that social media does more harm than good to students when it is not controlled, because it disturbs their studies and affects their mental health. Students should set clear time limits and use these platforms mainly for learning.'
            ],
            marks: {
              stand: 'I partly agree that social media does more harm than good when it is used without limits.',
              point: 'First and foremost, social media distracts students from their studies and their sleep.',
              explain: 'This is because apps are designed to keep users scrolling, so a short break can easily become two hours.',
              example: 'For instance, many students check their phones late at night and then struggle to concentrate in an 8 a.m. class.',
              link: 'Therefore, uncontrolled use can lower students’ academic performance.',
              concl: 'In conclusion, I believe that social media does more harm than good to students when it is not controlled, because it disturbs their studies and affects their mental health.'
            }
          },
          questions: []
        }
      ]
    }
  ];

  /* Full mock paper (MUET 800/4 timing: 75 minutes for both tasks, no help). */
  const MOCK = {
    id: 'MOCK',
    part: 'Mock paper',
    type: 'write',
    title: 'Full Mock Paper: MUET Writing (75 minutes)',
    guardian: 'Quilla the Fox Scribe',
    time: '75 minutes',
    examMinutes: 75,
    mock: true,
    skill: 'Mock paper',
    instructions: 'Exam conditions: one timer for both tasks (about 25 minutes for Task 1 and 50 minutes for Task 2). No frames or models until you finish.',
    parts: [
      {
        title: 'Task 1',
        rubric: 'You received an email from your classmate, Mei Ling. Read her email and the notes. Write a reply of at least 100 words, using all the notes given.',
        stimulus: {
          label: 'Email from Mei Ling',
          paras: ['Hi! Puan Nora is retiring at the end of this semester, and our class wants to throw her a surprise farewell party. Can you help me plan it? We need a place, some food and a gift. When can we meet to discuss it? Reply soon!']
        },
        notes: ['Place: suggest one', 'Food: your idea', 'Gift: suggest & why', 'Meet: when & where'],
        minWords: 100,
        tags: [
          { id: 'n1', label: 'Note ① Place' },
          { id: 'n2', label: 'Note ② Food' },
          { id: 'n3', label: 'Note ③ Gift & why' },
          { id: 'n4', label: 'Note ④ When & where' }
        ]
      },
      {
        title: 'Task 2',
        rubric: 'Write an essay of at least 250 words on the topic below. Support your answer with reasons and examples.',
        stimulus: {
          label: 'Essay topic',
          paras: ['Some people believe that every polytechnic student should complete an internship abroad before graduating. Do you agree? Give your opinion with reasons and examples.']
        },
        notes: [],
        minWords: 250,
        tags: [
          { id: 'stand', label: 'Intro: my stand' },
          { id: 'point', label: 'Point' },
          { id: 'explain', label: 'Explain' },
          { id: 'example', label: 'Example' },
          { id: 'link', label: 'Link back' },
          { id: 'concl', label: 'Conclusion' }
        ]
      }
    ],
    checks: [
      'Task 1: right tone for the reader and every note developed',
      'Task 2: clear stand, PEEL body paragraphs and a conclusion',
      'I checked grammar, spelling and paragraphing in both tasks'
    ],
    frames: [],
    questions: []
  };

  return { HEROES, WORLDS, MOCK };
})();
