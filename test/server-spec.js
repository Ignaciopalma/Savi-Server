'use strict'

const fs = require('fs');
const http = require('http');
const path = require('path');
const db = require('../db/db');
const express = require('express');
const request = require('supertest');
const expect = require('chai').expect;
const Sequelize = require('sequelize');
const helpers = require('../helpers.js');
const seeder = require('../db/seeder.js');
const config = require('../config/config');

const schema = new Sequelize('test', 'root', config.password, {logging: false});
const port = 1337;

const compareSomeKeys = (expected, actual) => {
  for (var key in expected) {
    if (actual.key !== expected.key) {
      return false;
    }
  }
  return true;
}

describe ('helper function tests', () => {

  after((done) => {
    fs.unlinkSync(path.join(__dirname, '../img/' + 'test-img0.jpg'));
    fs.unlinkSync(path.join(__dirname, '../img/' + 'test-img2.jpg'));
    fs.unlinkSync(path.join(__dirname, '../img/' + 'test-img3.png'));
    fs.unlinkSync(path.join(__dirname, '../img/' + 'test-img4.gif'));
    done();
  })

  it('saveImage should correctly save a valid image', (done) => {
    var imageSave = helpers.saveImage('http://i.imgur.com/zxPr3e8.jpg', 'test-img0');
    imageSave.then((imageName) => {
      expect(imageName).to.equal('test-img0.jpg', 'Should have the correct image name');
      let exists = fs.existsSync(path.join(__dirname, '../img/' + imageName));
      expect(exists).to.equal(true, 'Saved image should exist');
      done();
    });
  });

  it('saveImage should error on an invalid image URL', (done) => {
    var imageSave = helpers.saveImage('badurl', 'test-img1');
    imageSave.then((imageName) => {
      expect(imageName).to.not.exist;
      done();
    }, (error) => {
      expect(error).to.exist;
      done();
    });
  });

  it('saveImage should correctly save JPG files as such', (done) => {
    var imageSave = helpers.saveImage('http://i.imgur.com/zxPr3e8.jpg', 'test-img2');
    imageSave.then((imageName) => {
      expect(imageName).to.equal('test-img2.jpg', 'Should have the correct image name');
      let exists = fs.existsSync(path.join(__dirname, '../img/' + imageName));
      expect(exists).to.equal(true, 'Saved image should exist');
      done();
    });
  });

  it('saveImage should correctly save PNG files as such', (done) => {
    var imageSave = helpers.saveImage('http://i.imgur.com/JLTfOBL.png', 'test-img3');
    imageSave.then((imageName) => {
      expect(imageName).to.equal('test-img3.png', 'Should have the correct image name');
      let exists = fs.existsSync(path.join(__dirname, '../img/' + imageName));
      expect(exists).to.equal(true, 'Saved image should exist');
      done();
    });
  });

  it('saveImage should correctly save GIF files as such', (done) => {
    var imageSave = helpers.saveImage('http://i.imgur.com/9LEsBZn.gif', 'test-img4');
    imageSave.then((imageName) => {
      expect(imageName).to.equal('test-img4.gif', 'Should have the correct image name');
      let exists = fs.existsSync(path.join(__dirname, '../img/' + imageName));
      expect(exists).to.equal(true, 'Saved image should exist');
      done();
    });
  });
});

describe('Basic server tests', () => {
  var server, app;
  before((done) => {
    db.syncTables(true, schema).then(() => {done()});
  });

  beforeEach(() => {
    app = express();
    require('../routes')(app, express, db);
    server = app.listen(port, () => {
    });
  });
  afterEach((done) => {
    server.close(done);
  });

  it('should respond with 404 for unknown route', (done) => {
    request(server).get('/unknown').expect(404, done);
  });
});

describe('Cities endpoints', () => {
  var server, app;
  var city1Expected, city2Expected;

  before((done) => {
    city1Expected = {name: 'Gotham', mainImage: 'gotham_city.jpg'};
    city2Expected = {name: 'Metropolis', mainImage: 'metropolis_city.jpg'};

    db.syncTables(true, schema).then(() => {
      let cities = [];
      cities.push(db.City.create(city1Expected));
      cities.push(db.City.create(city2Expected));
      Promise.all(cities).then(() => {done()});
    });
  });

  beforeEach(() => {
    app = express();
    require('../routes')(app, express, db);
    server = app.listen(port, () => {
    });
  });
  afterEach((done) => {
    server.close(done);
  });

  after((done) => {
    fs.unlinkSync(path.join(__dirname, '../img/' + 'central-city_city.jpg'));
    done();
  });

  it('/api/cities should respond', (done) => {
    request(server).get('/api/cities').expect(200, done);
  });

  it('/api/cities?cityId=X should respond with cities previously added', (done) => {
    request(server).get('/api/cities').expect('[{"id":1,"name":"Gotham","mainImage":"gotham_city.jpg"},{"id":2,"name":"Metropolis","mainImage":"metropolis_city.jpg"}]', done);
  });

  it('/api/cities? should respond with a single city by id', (done) => {
    request(server).get('/api/cities?cityId=1').expect('{"id":1,"name":"Gotham","mainImage":"gotham_city.jpg"}', done);
  });

  it('post to /api/cities should create a new city', (done) => {
    request(server).post('/api/cities').send({name: 'Central City', mainImage: 'http://i.imgur.com/w1S5ZM5.jpg'}).expect('created Central City', done);
  });

  it('newly created city should respond correctly', (done) => {
    request(server).get('/api/cities?cityId=3').end((err, res) => {
      expect(compareSomeKeys({name: 'Central City', mainImage: 'central-city_city.jpg'}, res.body)).to.equal(true, 'server should be able to serve newly created city');
      done();
    })
  });

  it('post to /api/cities should respond with error for bad post body', (done) => {
    request(server).post('/api/cities').send({datum: 'Item', otherDatum: 'Other Item'}).expect(400, done);
  });

});

describe('Tours endpoints', () => {
  var server, app;
  var city1Expected, city2Expected;
  var tour1Expected, tour2Expected, tour3Expected, tour4Expected;
  before((done) => {
    city1Expected = {name: 'Gotham', mainImage: 'gotham_city.jpg'};
    city2Expected = {name: 'Metropolis', mainImage: 'metropolis_city.jpg'};

    tour1Expected = {cityId: 1, title: 'Tour 1', description: 'First tour', mainImage: 'tour1.jpg'};
    tour2Expected = {cityId: 1, title: 'Tour 2', description: 'Second tour', mainImage: 'tour2.jpg'};
    tour3Expected = {cityId: 2, title: 'Tour 3', description: 'Third tour', mainImage: 'tour3.jpg'};
    tour4Expected = {cityId: 2, title: 'Tour 4', description: 'Fourth tour', mainImage: 'tour4.jpg'};
    db.syncTables(true, schema).then(() => {
      let cities = [];
      cities.push(db.City.create(city1Expected));
      cities.push(db.City.create(city2Expected));
      Promise.all(cities).then(() => {
        let tours = [];
        tours.push(db.Tour.create(tour1Expected));
        tours.push(db.Tour.create(tour2Expected));
        tours.push(db.Tour.create(tour3Expected));
        tours.push(db.Tour.create(tour4Expected));
        Promise.all(tours).then(() => {done()});
      });
    });
  });

  beforeEach(() => {
    app = express();
    require('../routes')(app, express, db);
    server = app.listen(port, () => {
    });
  });
  afterEach((done) => {
    server.close(done);
  });

  after((done) => {
    fs.unlinkSync(path.join(__dirname, '../img/' + 'gotham-eats_tour.jpg'));
    done();
  });

  it('/api/tours/ should respond', (done) => {
    request(server).get('/api/tours').expect(200, done);
  });

  it('/api/tours/ should handle requesting tours by city', (done) => {
    request(server).get('/api/tours?cityId=1').end((err, res) => {
      expect(res.body.length).to.equal(2, 'should have exactly two tours');
      expect(compareSomeKeys(tour1Expected, res.body[0])).to.equal(true, 'should have the first tour');
      expect(compareSomeKeys(tour2Expected, res.body[1])).to.equal(true, 'should have the second tour');
      let hasCityTwoTours = false;
      for (var element of res.body) {
        hasCityTwoTours = hasCityTwoTours || element.cityId===2;
      }
      expect(hasCityTwoTours).to.equal(false, 'Should not have any tours from city 2');
      done();
    });
  });

  it('/api/tours?tourId=X should respond with the expected tour', (done) => {
    request(server).get('/api/tours?tourId=1').end((err, res) => {
      expect(compareSomeKeys(tour1Expected, res.body)).to.equal(true, 'should return exactly the first tour');
      done();
    });
  });

  it('post to /api/tours should create a new tour', (done) => {
    request(server).post('/api/tours').send({title: 'Gotham Eats', mainImage: 'http://i.imgur.com/zxPr3e8.jpg', description: 'Get some good eats in Gotham City', cityId: 1}).expect('created Gotham Eats', done);
  });

  it('post to /api/tours return an error when adding a tour to a city that does not exist', (done) => {
    request(server).post('/api/tours').send({title: 'Gotham Eats', mainImage: 'http://i.imgur.com/zxPr3e8.jpg', description: 'Get some good eats in Gotham City', cityId: 100}).expect(500, done);
  });

  it('newly created tour should respond correctly', (done) => {
    request(server).get('/api/tours?tourId=5').end((err, res) => {
      expect(compareSomeKeys({title: 'Gotham Eats', mainImage: 'gotham-eats_tour.jpg', description: 'Get some good eats in Gotham City', cityId: 100}, res.body)).to.equal(true, 'server should be able to serve newly created tour');
      done();
    })
  });

  it('post to /api/tours should respond with error for bad post body', (done) => {
    request(server).post('/api/tours').send({datum: 'Item', otherDatum: 'Other Item'}).expect(400, done);
  });
});

describe('Bookings endpoint', () => {
  var server, app;
  var city1Expected, city2Expected;
  var tour1Expected, tour2Expected, tour3Expected, tour4Expected;
  var user1Expected, user2Expected;
  before((done) => {
    city1Expected = {name: 'Gotham', mainImage: 'gotham_city.jpg'};
    city2Expected = {name: 'Metropolis', mainImage: 'metropolis_city.jpg'};

    tour1Expected = {cityId: 1, title: 'Tour 1', description: 'First tour', mainImage: 'tour1.jpg'};
    tour2Expected = {cityId: 1, title: 'Tour 2', description: 'Second tour', mainImage: 'tour2.jpg'};
    tour3Expected = {cityId: 2, title: 'Tour 3', description: 'Third tour', mainImage: 'tour3.jpg'};
    tour4Expected = {cityId: 2, title: 'Tour 4', description: 'Fourth tour', mainImage: 'tour4.jpg'};

    user1Expected = {
      type: 'Driver',
      userName: 'Bruce Wayne',
      userEmail: 'bwayne@wayneenterprises.com',
      mdn: '202-555-0173',
      country: 'USA',
      photo: 'bruce-wayne.jpg',
      cityId: 1
    }

    user2Expected = {
      type: 'Tour Guide',
      userName: 'Barbara Gordon',
      userEmail: 'bgordon@gcpd.gov',
      mdn: '202-555-0174',
      country: 'USA',
      photo: 'barbara-gordon.jpg',
      cityId: 1
    }

    db.syncTables(true, schema).then(() => {
      let cities = [];
      cities.push(db.City.create(city1Expected));
      cities.push(db.City.create(city2Expected));
      Promise.all(cities).then(() => {
        let toursAndUsers = [];
        toursAndUsers.push(db.Tour.create(tour1Expected));
        toursAndUsers.push(db.Tour.create(tour2Expected));
        toursAndUsers.push(db.Tour.create(tour3Expected));
        toursAndUsers.push(db.Tour.create(tour4Expected));
        toursAndUsers.push(db.UserData.create(user1Expected));
        toursAndUsers.push(db.UserData.create(user2Expected));
        Promise.all(toursAndUsers).then(() => {done()});
      });
    });
  });

  beforeEach(() => {
    app = express();
    require('../routes')(app, express, db);
    server = app.listen(port, () => {
    });
  });
  afterEach((done) => {
    server.close(done);
  });

  it('/api/bookings should respond with 400 if no/incorrect queries supplied', (done) => {
    request(server).get('/api/bookings').expect(400, done);
  });

  it('/api/bookings should respond with a booking object with queried', (done) => {
    request(server).get('/api/bookings?tourId=1&date=testDate').end((err, res) => {
      expect(compareSomeKeys(user1Expected, res.body.driver)).to.equal(true, 'Should have the correct driver');
      expect(compareSomeKeys(user2Expected, res.body.guide)).to.equal(true, 'Should have the correct tourguide');
      expect(compareSomeKeys(city1Expected, res.body.city)).to.equal(true, 'Should have the correct city');
      expect(compareSomeKeys(tour1Expected, res.body.tour)).to.equal(true, 'Should have the correct tour');
      expect(res.body.date).to.equal('testDate', 'should have the correct date');
      done();
    });
  });

});

describe('Images endpoint', () => {
  var server, app;

  before((done) => {
    helpers.saveImage('http://i.imgur.com/zxPr3e8.jpg', 'test-img0').then(() => {done()});
  });

  beforeEach(() => {
    app = express();
    require('../routes')(app, express, db);
    server = app.listen(port, () => {
    });
  });
  afterEach((done) => {
    server.close(done);
  });

  after((done) => {
    fs.unlinkSync(path.join(__dirname, '../img/' + 'test-img0.jpg'));
    done();
  });

  it('/api/images should return an error for a nonexistant image', (done) => {
    request(server).get('/api/images/nonexistantImage').expect(404, done);
  });

  it('/api/images should return properly for a requested image that exists', (done) => {
    request(server).get('/api/images/test-img0.jpg').expect(200, done);
  })
});