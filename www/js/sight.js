sight = {
	version: 3,
	isTouchDevice: false,
	lessons: {},
	current: null,
	profile: null,

	settings: {
		version: 3,
		profiles: {
			'Serenity': {
				subjects: {},
				current: 'Kindergarten'
			}
		}
	},

	templates: {
		memorize: null,
		lessonHeader: null,
	},

	// Functions
	initializeCommon: function() {
		if ('ontouchstart' in window) {
			if (Origami) // Some content blockers block this.
				Origami.fastclick(document.body);
			sight.isTouchDevice = true;
			$('body').addClass('touch');
		}

		// Templates
		sight.templates.memorize = doT.template($('#memorize-template').text());
		sight.templates.lessonHeader = doT.template($('#lesson-header-template').text());

		// Hydrate data objects
		for (var i = 0; i < sight.data.subjects.length; i++) {
			var subjectData = sight.data.subjects[i];
			for (var ii = 0; ii < subjectData.levels.length; ii++) {
				var levelInfo = subjectData.levels[ii];
				var tmp = { name: levelInfo.name, subject: subjectData.name, type: levelInfo.type, entries: levelInfo.entries };
				var lesson = new sight.lesson(tmp);
				sight.lessons[lesson.name] = lesson;
			}
		}

		// Load settings
		sight.settings = sight.store.load();
	},

	initialize: function() {
		sight.initializeCommon();

		sight.profile = _.values(sight.settings.profiles)[0];

		sight.lesson.duplicateCheck();
		sight.ui.loadLesson();
		sight.events.initialize();
	}
};

sight.events = {
	startPosition: null,

	initialize: function() {
		$('#answer').click(sight.events.perfectClicked);
		$('#header').click(sight.events.headerClicked);
		$('body')
			.click(sight.events.bodyClicked)
			.bind('touchstart', sight.events.touchStart)
			.bind('touchend', sight.events.touchEnd);

		// Prevent all scrolling
		document.ontouchmove = function(e) { e.preventDefault(); };
	},

	bodyClicked: function(e) {
        var pos = e.originalEvent.changedTouches ? e.originalEvent.changedTouches[0] : e;

		e.stopPropagation();

		var target = pos.currentTarget;
		var g = { x: target.clientLeft, y: target.clientTop, w: target.clientWidth, h: target.clientHeight };

		g.prevX = (g.x + g.w) / 4;
		g.nextX = g.w - g.prevX;

		if (pos.clientX > g.nextX)
			sight.ui.next();
		else if (pos.clientX < g.prevX)
			sight.ui.previous();

		return false;
	},

	perfectClicked: function(e) {
		e.stopPropagation();

		sight.current.toggleKnown();
		sight.store.save();

		sight.ui.redisplay(false);

		return false;
	},

	headerClicked: function(e) {
		e.stopPropagation();

		var lessons = _.keys(sight.lessons);
		var next = lessons.indexOf(sight.profile.current) + 1;
		sight.profile.current = lessons[next % lessons.length];

		sight.ui.loadLesson();
		sight.store.save();
	},

	touchStart: function(e) {
		var start = e.originalEvent.changedTouches[0];
		sight.events.startPosition = { x: start.clientX, y: start.clientY };
	},

	touchEnd: function(e) {
		// Detect gestures.
		var end = e.originalEvent.changedTouches ? e.originalEvent.changedTouches[0] : e;
		var gesture = sight.events.detectGesture(sight.events.startPosition, end);

		if (gesture == 'swipe-left')
			sight.ui.previous();
		else if (gesture == 'swipe-right')
			sight.ui.next();

		sight.events.startPosition = null;	
	},

	detectGesture: function(start, end) {
		var delta = { x: start.x - end.clientX, y: start.y - end.clientY };

		if (delta.x >= 100)
			return 'swipe-right';
		if (delta.x <= -100)
			return 'swipe-left';

		return null;
	}
};

sight.store = {
	load: function() {
		if (!localStorage.sightSettings)
			return sight.settings;

		var settings = JSON.parse(localStorage.sightSettings);
		if (settings.version != sight.version)
			return sight.settings;

		sight.settings = settings;
		return settings;
	},

	save: function() {
		var settings = sight.settings;

		var lesson = sight.current;
		sight.profile.subjects[lesson.name] = lesson.save();

		localStorage.sightSettings = JSON.stringify({ 
			version: settings.version,
			profiles: settings.profiles
		});
	}
};

sight.ui = {
	loadLesson: function() {
		var lesson = sight.lessons[sight.profile.current];
		lesson.load(sight.profile.subjects[lesson.name]);

		// Store and start!
		sight.current = lesson;
		sight.ui.redisplay(true);
	},

	showLesson: function(lesson, doAnimation) {
		var model = {
			entry: lesson.entry.value,
			checked: lesson.entry.known
		};

		var $card = $(lesson.template(model));
		if (doAnimation)
			$('.entry-animated', $card).addClass('in');

		$('#content').empty().append($card);

		// Resize text to fill width.
		sight.ui.setTextSize($card);

		$('#perfect').toggleClass('active', model.checked ? true : false);
	},

	setTextSize: function($card) {
		var maxFontSize = 512;
		var minFontSize = 24;

		var $questionContainer = $('.question-container', $card);
		var questionContainerElement = $questionContainer[0];

		// Set initial font size.
		var fontSize = maxFontSize;
		$questionContainer.css('font-size', fontSize + 'px');

		// Reduce font size until there is no scrollWidth.
		while (questionContainerElement.scrollWidth > questionContainerElement.offsetWidth && fontSize >= minFontSize) {
			fontSize--;
			$questionContainer.css('font-size', fontSize + 'px');
		}
	},

	showHeader: function() {
		var knownInList = 0;
		var list = sight.current.list;
		for (var i = 0; i < list.length; i++) {
			if (sight.current.isKnown(list[i]))
				knownInList++;
		}

		var model = {
			number: sight.current.pos + 1,
			max: list.length,
			learned: Math.round((knownInList / list.length) * 100),
			lesson: sight.profile.current
		};

		var $header = $(sight.templates.lessonHeader(model));
		$('#header').empty().append($header);
	},

	redisplay: function(doAnimation) {
		sight.ui.showLesson(sight.current, doAnimation);
		sight.ui.showHeader();
	},

	next: function() {
		if (sight.current.next())
			sight.ui.redisplay(true);
	},

	previous: function() {
		if (sight.current.previous())
			sight.ui.redisplay(true);
	}
};

sight.util = {
	indexKeys: function(arr) {
		var index = {};
		for (var i = 0; i < arr.length; i++)
			index[arr[i]] = 1;
		return index;
	}
};
