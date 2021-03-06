if (process.env.NODE_ENV !== 'development') {
  require('newrelic');
}
require('dotenv').load();
// handle uncaught exceptions. Forever will restart process on shutdown
process.on('uncaughtException', function (err) {
  console.error(
    (new Date()).toUTCString() + ' uncaughtException:',
    err.message
  );
  console.error(err.stack);
  /* eslint-disable no-process-exit */
  process.exit(1);
  /* eslint-enable no-process-exit */
});

var express = require('express'),
  accepts = require('accepts'),
  cookieParser = require('cookie-parser'),
  compress = require('compression'),
  session = require('express-session'),
  logger = require('morgan'),
  errorHandler = require('errorhandler'),
  methodOverride = require('method-override'),
  bodyParser = require('body-parser'),
  helmet = require('helmet'),
  MongoStore = require('connect-mongo')(session),
  flash = require('express-flash'),
  path = require('path'),
  mongoose = require('mongoose'),
  passport = require('passport'),
  expressValidator = require('express-validator'),
  connectAssets = require('connect-assets'),
  request = require('request'),

    /**
     * Controllers (route handlers).
     */
    homeController = require('./controllers/home'),
    resourcesController = require('./controllers/resources'),
    userController = require('./controllers/user'),
    contactController = require('./controllers/contact'),
    nonprofitController = require('./controllers/nonprofits'),
    bonfireController = require('./controllers/bonfire'),
    coursewareController = require('./controllers/courseware'),
    fieldGuideController = require('./controllers/fieldGuide'),
    challengeMapController = require('./controllers/challengeMap'),

    /**
     *  Stories
     */
    storyController = require('./controllers/story');

    /**
     * API keys and Passport configuration.
     */
    secrets = require('./config/secrets'),
    passportConf = require('./config/passport');

/**
 * Create Express server.
 */
var app = express();

/**
 * Connect to MongoDB.
 */
mongoose.connect(secrets.db);
mongoose.connection.on('error', function () {
    console.error(
        'MongoDB Connection Error. Please make sure that MongoDB is running.'
    );
});

/**
 * Express configuration.
 */


app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(compress());
var oneYear = 31557600000;
app.use(express.static(__dirname + '/public', {maxAge: oneYear}));
app.use(connectAssets({
    paths: [
        path.join(__dirname, 'public/css'),
        path.join(__dirname, 'public/js')
    ],
    helperContext: app.locals
}));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(expressValidator({
    customValidators: {
        matchRegex: function (param, regex) {
            return regex.test(param);
        }
    }
}));
app.use(methodOverride());
app.use(cookieParser());
app.use(session({
  resave: true,
  saveUninitialized: true,
  secret: secrets.sessionSecret,
  store: new MongoStore({
    url: secrets.db,
    'autoReconnect': true
  })
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
app.disable('x-powered-by');

app.use(helmet.xssFilter());
app.use(helmet.noSniff());
app.use(helmet.xframe());
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

var trusted = [
  "'self'",
  '*.freecodecamp.com',
  '*.gstatic.com',
  '*.google-analytics.com',
  '*.googleapis.com',
  '*.google.com',
  '*.gstatic.com',
  '*.doubleclick.net',
  '*.twitter.com',
  '*.twitch.tv',
  '*.twimg.com',
  "'unsafe-eval'",
  "'unsafe-inline'",
  '*.rafflecopter.com',
  '*.bootstrapcdn.com',
  '*.cloudflare.com',
  'https://*.cloudflare.com',
  'localhost:3001',
  'ws://localhost:3001/',
  'http://localhost:3001',
  'localhost:3000',
  'ws://localhost:3000/',
  'http://localhost:3000',
  '*.ionicframework.com',
  'https://syndication.twitter.com',
  '*.youtube.com',
  '*.jsdelivr.net',
  'https://*.jsdelivr.net',
  '*.togetherjs.com',
  'https://*.togetherjs.com',
  'wss://hub.togetherjs.com',
  '*.ytimg.com',
  'wss://fcctogether.herokuapp.com',
  '*.bitly.com',
  'http://cdn.inspectlet.com/',
  'http://hn.inspectlet.com/'
];

app.use(helmet.contentSecurityPolicy({
    defaultSrc: trusted,
    scriptSrc: [
        '*.optimizely.com',
        '*.aspnetcdn.com',
        '*.d3js.org',
    ].concat(trusted),
    'connect-src': [
        'ws://*.rafflecopter.com',
        'wss://*.rafflecopter.com',
        'https://*.rafflecopter.com',
        'ws://www.freecodecamp.com',
        'http://www.freecodecamp.com'
    ].concat(trusted),
    styleSrc: trusted,
    imgSrc: [
        '*.evernote.com',
        '*.amazonaws.com',
        'data:',
        '*.licdn.com',
        '*.gravatar.com',
        '*.akamaihd.net',
        'graph.facebook.com',
        '*.githubusercontent.com',
        '*.googleusercontent.com',
        '*' /* allow all input since we have user submitted images for public profile*/
    ].concat(trusted),
    fontSrc: ['*.googleapis.com'].concat(trusted),
    mediaSrc: [
        '*.amazonaws.com',
        '*.twitter.com'
    ].concat(trusted),
    frameSrc: [
        '*.gitter.im',
        '*.gitter.im https:',
        '*.vimeo.com',
        '*.twitter.com',
        '*.rafflecopter.com',
        '*.ghbtns.com'
    ].concat(trusted),
    reportOnly: false, // set to true if you only want to report errors
    setAllHeaders: false, // set to true if you want to set all headers
    safari5: false // set to true if you want to force buggy CSP in Safari 5
}));

app.use(function (req, res, next) {
  // Make user object available in templates.
  res.locals.user = req.user;
  next();
});

app.use(function (req, res, next) {
    // Remember original destination before login.
    var path = req.path.split('/')[1];
    if (/auth|login|logout|signin|signup|fonts|favicon/i.test(path)) {
        return next();
    } else if (/\/stories\/comments\/\w+/i.test(req.path)) {
        return next();
    }
    req.session.returnTo = req.path;
    next();
});

app.use(
  express.static(path.join(__dirname, 'public'), {maxAge: 31557600000})
);

app.use(express.static(__dirname + '/public', { maxAge: 86400000 }));

/**
 * Main routes.
 */

app.get('/', homeController.index);

app.get('/privacy', function(req, res) {
    res.redirect(301, "/field-guide/free-code-camp's-privacy-policy");
});

app.get('/nonprofit-project-instructions', function(req, res) {
    res.redirect(301, "/field-guide/free-code-camp's-privacy-policy");
});

app.get('/chat', resourcesController.chat);

app.get('/twitch', resourcesController.twitch);

app.get('/map', challengeMapController.challengeMap);

app.get('/live-pair-programming', function(req, res) {
    res.redirect(301, '/field-guide/live-stream-pair-programming-on-twitch.tv');
});

app.get('/install-screenhero', function(req, res) {
    res.redirect(301, '/field-guide/install-screenhero');
});

app.get('/guide-to-our-nonprofit-projects', function(req, res) {
    res.redirect(301, '/field-guide/a-guide-to-our-nonprofit-projects');
});

app.get('/chromebook', function(req, res) {
    res.redirect(301, '/field-guide/chromebook');
});

app.get('/deploy-a-website', function(req, res) {
    res.redirect(301, '/field-guide/deploy-a-website');
});

app.get('/gmail-shortcuts', function(req, res) {
    res.redirect(301, '/field-guide/gmail-shortcuts');
});

app.get('/nodeschool-challenges', function(req, res) {
    res.redirect(301, '/field-guide/nodeschool-challenges');
});


app.get('/news', function(req, res) {
  res.redirect(301, '/stories/hot');
});
app.get('/learn-to-code', resourcesController.about);
app.get('/about', function(req, res) {
  res.redirect(301, '/learn-to-code');
});
app.get('/signin', userController.getSignin);

app.get('/login', function(req, res) {
  res.redirect(301, '/signin');
});

app.post('/signin', userController.postSignin);

app.get('/signout', userController.signout);

app.get('/logout', function(req, res) {
  res.redirect(301, '/signout');
});

app.get('/forgot', userController.getForgot);

app.post('/forgot', userController.postForgot);

app.get('/reset/:token', userController.getReset);

app.post('/reset/:token', userController.postReset);

app.get('/email-signup', userController.getEmailSignup);

app.get('/email-signin', userController.getEmailSignin);

app.post('/email-signup', userController.postEmailSignup);

app.post('/email-signin', userController.postSignin);
app.get('/nonprofits', contactController.getNonprofitsForm);
app.post('/nonprofits', contactController.postNonprofitsForm);

/**
 * Nonprofit Project routes.
 */

app.get('/nonprofits', nonprofitController.nonprofitsHome);

app.get('/nonprofits/directory', nonprofitController.nonprofitsDirectory);

app.get('/nonprofits/are-you-with-a-registered-nonprofit', nonprofitController.areYouWithARegisteredNonprofit);

app.get('/nonprofits/are-there-people-that-are-already-benefiting-from-your-services', nonprofitController.areTherePeopleThatAreAlreadyBenefitingFromYourServices);

app.get('/nonprofits/in-exchange-we-ask', nonprofitController.inExchangeWeAsk);

app.get('/nonprofits/ok-with-javascript', nonprofitController.okWithJavaScript);

app.get('/nonprofits/how-can-free-code-camp-help-you', nonprofitController.howCanFreeCodeCampHelpYou);

app.get('/nonprofits/what-does-your-nonprofit-do', nonprofitController.whatDoesYourNonprofitDo);

app.get('/nonprofits/link-us-to-your-website', nonprofitController.linkUsToYourWebsite);

app.get('/nonprofits/tell-us-your-name', nonprofitController.tellUsYourName);

app.get('/nonprofits/tell-us-your-email', nonprofitController.tellUsYourEmail);

app.get('/nonprofits/your-nonprofit-project-application-has-been-submitted', nonprofitController.yourNonprofitProjectApplicationHasBeenSubmitted);

app.get('/nonprofits/other-solutions', nonprofitController.otherSolutions);

app.get('/nonprofits/getNonprofitList', nonprofitController.showAllNonprofits);

app.get('/nonprofits/interested-in-nonprofit/:nonprofitName', nonprofitController.interestedInNonprofit);

app.get(
    '/nonprofits/:nonprofitName',
    nonprofitController.returnIndividualNonprofit
);

app.get(
  '/done-with-first-100-hours',
  passportConf.isAuthenticated,
  contactController.getDoneWithFirst100Hours
);
app.post(
  '/done-with-first-100-hours',
  passportConf.isAuthenticated,
  contactController.postDoneWithFirst100Hours
);
//app.get(
//  '/nonprofit-project-instructions',
//  passportConf.isAuthenticated,
//  resourcesController.nonprofitProjectInstructions
//);
app.post(
  '/update-progress',
  passportConf.isAuthenticated,
  userController.updateProgress
);

app.get('/api/slack', function(req, res) {
  if (req.user) {
    if (req.user.email) {
      var invite = {
        'email': req.user.email,
        'token': process.env.SLACK_KEY,
        'set_active': true
      };

      var headers = {
        'User-Agent': 'Node Browser/0.0.1',
        'Content-Type': 'application/x-www-form-urlencoded'
      };

      var options = {
        url: 'https://freecode.slack.com/api/users.admin.invite',
        method: 'POST',
        headers: headers,
        form: invite
      };

      request(options, function (error, response, body) {
        if (!error && response.statusCode === 200) {
          req.flash('success', {
            msg: "We've successfully requested an invite for you. Please check your email and follow the instructions from Slack."
          });
          req.user.sentSlackInvite = true;
          req.user.save(function(err, user) {
            if (err) {
              next(err);
            }
            return res.redirect('back');
          });
        } else {
          req.flash('errors', {
            msg: "The invitation email did not go through for some reason. Please try again or <a href='mailto:team@freecodecamp.com?subject=slack%20invite%20failed%20to%20send>email us</a>."
          });
          return res.redirect('back');
        }
      })
    } else {
      req.flash('notice', {
        msg: "Before we can send your Slack invite, we need your email address. Please update your profile information here."
      });
      return res.redirect('/account');
    }
  } else {
    req.flash('notice', {
      msg: "You need to sign in to Free Code Camp before we can send you a Slack invite."
    });
    return res.redirect('/account');
  }
});

/**
 * Camper News routes.
 */
app.get(
  '/stories/hotStories',
  storyController.hotJSON
);

app.get(
  '/stories/recentStories',
  storyController.recentJSON
);

app.get(
  '/stories/',
  function(req, res) {
    res.redirect(302, '/stories/hot');
  }
);

app.get(
  '/stories/comments/:id',
  storyController.comments
);

app.post(
  '/stories/comment/',
  storyController.commentSubmit
);

app.post(
  '/stories/comment/:id/comment',
  storyController.commentOnCommentSubmit
);

app.get(
  '/stories/submit',
  storyController.submitNew
);

app.get(
  '/stories/submit/new-story',
  storyController.preSubmit
);

app.post(
  '/stories/preliminary',
  storyController.newStory
);

app.post(
  '/stories/',
  storyController.storySubmission
);

app.get(
  '/stories/hot',
  storyController.hot
);

app.get(
  '/stories/recent',
  storyController.recent
);


app.get(
  '/stories/search',
  storyController.search
);

app.post(
  '/stories/search',
  storyController.getStories
);

app.get(
  '/stories/:storyName',
  storyController.returnIndividualStory
);

app.post(
  '/stories/upvote/',
  storyController.upvote
);

app.all('/account', passportConf.isAuthenticated);

app.get('/account/api', userController.getAccountAngular);

/**
 * API routes
 */

app.get('/api/github', resourcesController.githubCalls);

app.get('/api/blogger', resourcesController.bloggerCalls);

app.get('/api/trello', resourcesController.trelloCalls);

/**
 * Bonfire related routes
 */

app.get('/field-guide/getFieldGuideList', fieldGuideController.showAllFieldGuides);

app.get('/playground', bonfireController.index);

app.get('/bonfires', bonfireController.returnNextBonfire);

app.get('/bonfire-json-generator', bonfireController.returnGenerator);

app.post('/bonfire-json-generator', bonfireController.generateChallenge);

app.get('/bonfire-challenge-generator', bonfireController.publicGenerator);

app.post('/bonfire-challenge-generator', bonfireController.testBonfire);

app.get(
  '/bonfires/:bonfireName',
  bonfireController.returnIndividualBonfire
);

app.get('/bonfire', function(req, res) {
  res.redirect(301, '/playground');
});

app.post('/completed-bonfire/', bonfireController.completedBonfire);

/**
 * Field Guide related routes
 */


app.get('/field-guide/:fieldGuideName', fieldGuideController.returnIndividualFieldGuide);

app.get('/field-guide', fieldGuideController.returnNextFieldGuide);

app.post('/completed-field-guide/', fieldGuideController.completedFieldGuide);


/**
 * Courseware related routes
 */

app.get('/challenges/', coursewareController.returnNextCourseware);

app.get(
    '/challenges/:coursewareName',
    coursewareController.returnIndividualCourseware
);

app.post('/completed-courseware/', coursewareController.completedCourseware);

app.post('/completed-zipline-or-basejump',
  coursewareController.completedZiplineOrBasejump);

// Unique Check API route
app.get('/api/checkUniqueUsername/:username', userController.checkUniqueUsername);

app.get('/api/checkExistingUsername/:username', userController.checkExistingUsername);

app.get('/api/checkUniqueEmail/:email', userController.checkUniqueEmail);

app.get('/account', userController.getAccount);

app.post('/account/profile', userController.postUpdateProfile);

app.post('/account/password', userController.postUpdatePassword);

app.post('/account/delete', userController.postDeleteAccount);

app.get('/account/unlink/:provider', userController.getOauthUnlink);

app.get('/sitemap.xml', resourcesController.sitemap);

/**
 * OAuth sign-in routes.
 */

var passportOptions = {
  successRedirect: '/',
  failureRedirect: '/login'
};

app.get('/auth/twitter', passport.authenticate('twitter'));

app.get(
  '/auth/twitter/callback',
  passport.authenticate('twitter', {
    successRedirect: '/',
    failureRedirect: '/login'
  })
);

app.get(
  '/auth/linkedin',
  passport.authenticate('linkedin', {
    state: 'SOME STATE'
  })
);

app.get(
  '/auth/linkedin/callback',
  passport.authenticate('linkedin', passportOptions)
);

app.get(
  '/auth/facebook',
  passport.authenticate('facebook', {scope: ['email', 'user_location']})
);

app.get(
  '/auth/facebook/callback',
  passport.authenticate('facebook', passportOptions), function (req, res) {
    res.redirect(req.session.returnTo || '/');
  }
);

app.get('/auth/github', passport.authenticate('github'));

app.get(
  '/auth/github/callback',
  passport.authenticate('github', passportOptions), function (req, res) {
    res.redirect(req.session.returnTo || '/');
  }
);

app.get(
  '/auth/google',
  passport.authenticate('google', {scope: 'profile email'})
);

app.get(
  '/auth/google/callback',
  passport.authenticate('google', passportOptions), function (req, res) {
    res.redirect(req.session.returnTo || '/');
  }
);

// put this route last
app.get(
  '/:username',
  userController.returnUser
);

/**
 * 500 Error Handler.
 */
if (process.env.NODE_ENV === 'development') {
  app.use(errorHandler({ log: true }));
} else {
  // error handling in production
  app.use(function(err, req, res, next) {

    // respect err.status
    if (err.status) {
      res.statusCode = err.status;
    }

    // default status code to 500
    if (res.statusCode < 400) {
      res.statusCode = 500;
    }

    // parse res type
    var accept = accepts(req);
    var type = accept.type('html', 'json', 'text');

    var message = 'opps! Something went wrong. Please try again later';
    if (type === 'html') {
      req.flash('errors', { msg: message });
      return res.redirect('/');
      // json
    } else if (type === 'json') {
      res.setHeader('Content-Type', 'application/json');
      return res.send({ message: message });
      // plain text
    } else {
      res.setHeader('Content-Type', 'text/plain');
      return res.send(message);
    }
  });
}

/**
 * Start Express server.
 */
app.listen(app.get('port'), function () {
  console.log(
    'FreeCodeCamp server listening on port %d in %s mode',
    app.get('port'),
    app.get('env')
  );
});

module.exports = app;
