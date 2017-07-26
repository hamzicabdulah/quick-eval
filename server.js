var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var path = process.cwd();
require('dotenv').config();

var siteLink = 'http://stomfak.ukim.edu.mk/';
var evalLink = siteLink + 'eval_kl_student_evaluacija_6.php?nid=1';

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(express.static(path + '/public'));

app.post('/api/eval', function(req, res) {
    var Nightmare = require('nightmare');
    var nightmare = Nightmare({ show: false });

    console.log('Starting login.');
    console.log(req.body);

    nightmare.goto(siteLink)
        .wait('a')
        .click('a')
        .wait('#korime')
        //Log in to website
        .insert('#korime', req.body.email)
        .insert('#lozinka', req.body.pass)
        .click('.kopce')
        .wait(3000)
        .exists('img')
        .then(function (logged) {
            if (logged) {
                console.log('Login successful.');
                return nightmare.goto(evalLink)
                    .wait('a.opis')
                    .inject('js', 'jquery-3.2.1.min.js')
                    .evaluate(() => {
                        var subjects = [];
                        $('a.opis').each(function(index) {
                            if ((index === 0 || index % 2 === 0) && index !== ($('a.opis').length - 1))
                                subjects.push($(this).attr('href'));
                        });
                        return subjects;
                    })
                    .then((subjects) => {
                        console.log('Gathered ' + subjects.length + ' subjects.');
                        gatherAllLinks(0, subjects, []).then((allLinks) => {
                            console.log('Gathered ' + allLinks.length + ' subjects/teachers to evaluate.');
                            addRatingsAndSubmit(0, allLinks).then((message) => {
                                console.log(message);
                                res.send({'status': message});
                                return nightmare.end();
                            });
                        });
                    })
                    .catch(() => {
                        console.log('Something wrong happened.');
                        res.send({'status': 'failed'});
                        return nightmare.end();
                    })
            } else {
                console.log('Login failed.');
                res.send({'status': 'invalid'});
                return nightmare.end();
            }
        })
        .catch(() => {
            console.log('Something wrong happened.');
            res.send({'status': 'failed'});
            return nightmare.end();
        })

    function gatherAllLinks(index, subjects, allLinks) {
        // Recursive procedure
        // Gather evaluation page links for 4 teachers and the subject page link
        return nightmare.goto(siteLink + subjects[index])
            .wait('.opis a')
            .inject('js', 'jquery-3.2.1.min.js')
            .evaluate(() => {
                var links = [];
                if ($('a.opis').length > 2) {
                    links.push($('a.opis').attr('href'));
                }
                $('.opis a').each(function(index) {
                    if (index === 0 || index === 1 || index === ($('.opis a').length - 1) || index === ($('.opis a').length - 2)) {
                        var link = $(this).attr('href');
                        if (links.indexOf(link) < 0) {
                            links.push(link);
                        }
                    }
                });
                return links;
            })
            .then((links) => {
                var gatheredLinks = links.concat(allLinks);
                if ((index + 1) < subjects.length) {
                    return gatherAllLinks((index + 1), subjects, gatheredLinks);
                } else {
                    return gatheredLinks;
                }
            });
    }

    function addRatingsAndSubmit(index, allLinks) {
        // Recursive procedure
        // Fill in all checkboxes and submit evaluation
        return nightmare.goto(siteLink + allLinks[index])
            .evaluate(() => {
                var inputs = document.querySelectorAll('input');
                for (var i = 0; i < inputs.length; i++) {
                    if (i !== (inputs.length - 1)) {
                        inputs[i].click();
                    }
                }
            })
            .then(() => {
                if ((index + 1) < allLinks.length) {
                    return addRatingsAndSubmit((index + 1), allLinks);
                } else {
                    return "success";
                }
            });
    }
});

app.get(function(req, res) {
    var Nightmare = require('nightmare');
    var nightmare = Nightmare({ show: true });

    nightmare.end();
    res.send({'status': 'canceled'});
});

app.listen(process.env.PORT, function() {
    console.log('Listening on port ' + process.env.PORT + '.');
});
