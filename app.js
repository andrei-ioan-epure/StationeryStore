const cookieParser = require("cookie-parser");
const session = require("express-session");
const express = require("express");
const expressLayouts = require("express-ejs-layouts");
const bodyParser = require("body-parser");
const app = express();
app.use(cookieParser());
app.use(
  session({
    secret: "secret",
    resave: false,
    saveUninitialized: false,
  })
);
const port = 6789;
// directorul 'views' va conține fișierele .ejs (html + js executat la server)
app.set("view engine", "ejs");
// suport pentru layout-uri - implicit fișierul care reprezintă template-ul site-ului este views/layout.ejs
app.use(expressLayouts);
// directorul 'public' va conține toate resursele accesibile direct de către client (e.g., fișiere css, javascript, imagini)
app.use(express.static("public"));

// corpul mesajului poate fi interpretat ca json; datele de la formular se găsesc în format json în req.body
app.use(bodyParser.json());
// utilizarea unui algoritm de deep parsing care suportă obiecte în obiecte
app.use(bodyParser.urlencoded({ extended: true }));
// la accesarea din browser adresei http://localhost:6789/ se va returna textul 'Hello World'
// proprietățile obiectului Request - req - https://expressjs.com/en/api.html#req
// proprietățile obiectului Response - res - https://expressjs.com/en/api.html#res
//app.get('/', (req, res) => res.send('Hello World'));
// la accesarea din browser adresei http://localhost:6789/chestionar se va apela funcția specificată

var blackList = [];
var listOfFails = {};
var listOfFailsLong = {};

var intervalID = setInterval(deblocheazaUtilizator, 60 * 60 * 1000);

setTimeout(function () {
  clearInterval(intervalID);

  intervalID = setInterval(deblocheazaUtilizator, 60 * 60 * 1000);
}, 60 * 60 * 1000);

const fs = require("fs");
let listaIntrebari;
fs.readFile("intrebari.json", (err, data) => {
  if (err) throw err;
  listaIntrebari = JSON.parse(data);
});

let listOfUsers;
fs.readFile("utilizatori.json", (err, data) => {
  if (err) throw err;
  listOfUsers = JSON.parse(data);
});

const { Client } = require("pg");
const client = new Client({
  user: "postgres",
  host: "localhost",
  database: "cumparaturi",
  password: "postgres",
  port: 5432,
});

const execute = async (query) => {
  try {
    await client.query(query); // sends queries
    return true;
  } catch (error) {
    console.error(error.stack);
    return false;
  }
};

const getProduse = async () => {
  const query = `SELECT * FROM "produse" `;
  try {
    const { rows } = await client.query(query); // sends queries
    return rows;
  } catch (error) {
    console.error(error.stack);
  }
};

const getProdusById = async (id) => {
  try {
    const { rows } = await client.query(
      `SELECT nume,pret FROM "produse" WHERE id=($1);`,
      [id]
    );
    // console.log(rows);
    return rows;
  } catch (error) {
    console.error(error.stack);
  }
};

client.connect(function (err) {
  if (err) throw err;
  console.log("Connected!");
});

// Funcția care va fi apelată când expiră blocarea pentru un utilizator
function deblocheazaUtilizator(data) {
  if (typeof data !== "undefined") {
    listOfFails[data][0] = 0;
    var index = blackList.indexOf(data);
    if (index !== -1) {
      blackList.splice(index, 1);
      console.log("Utilizatorul - " + data + " a fost deblocat.");
    }
  } else {
    console.log(" Reset total");
    listOfFails = {};
    blackList = [];
  }
}

app.use((req, res, next) => {
  var numeUtilizator = req.session.utilizator;
  var ipUtilizator = req.ip;
  if (blackList.includes(numeUtilizator) || blackList.includes(ipUtilizator)) {
    res.status(403);
    res.send("Accesul este blocat temporar.");
  } else {
    next();
  }
});

app.get("/", (req, res) => {
  res.cookie("mesajEroare", "false");
  var numeUtilizator = req.session.utilizator;
  var tipUtilizator = req.session.tip;

  //var numeUtilizator = req.cookies.utilizator;
  //var tipUtilizator = req.cookies.tip;

  var listOfProducts;
  getProduse().then((result) => {
    //  console.log(result)
    listOfProducts = result;
    // console.log(listOfProducts)
    res.render("index", {
      nume: numeUtilizator,
      produse: listOfProducts,
      tip: tipUtilizator,
    });
  });
});

app.get("/chestionar", (req, res) => {
  var numeUtilizator = req.session.utilizator;
  if (typeof numeUtilizator !== "undefined") {
    // în fișierul views/chestionar.ejs este accesibilă variabila 'intrebari' care conține vectorul de întrebări
    res.render("chestionar", {
      intrebari: listaIntrebari,
      nume: numeUtilizator,
    });
  } else {
    res.redirect("/");
  }
});

app.get("/autentificare", (req, res) => {
  var succes = req.cookies.mesajEroare;
  // în fișierul views/chestionar.ejs este accesibilă variabila 'intrebari' care conține vectorul de întrebări
  res.render("autentificare", { mesaj: succes });
});
app.post("/rezultat-chestionar", (req, res) => {
  var numeUtilizator = req.session.utilizator;
  //var numeUtilizator=req.cookies.utilizator;
  if (typeof numeUtilizator !== "undefined") {
    var nrRaspunsuriCorecte = 0;
    var raspunsuriUser = [];
    for (let i = 0; i < listaIntrebari.length; i++) {
      let raspunsIntrebareCurenta = req.body[i];
      raspunsuriUser.push(raspunsIntrebareCurenta);
      if (raspunsIntrebareCurenta === listaIntrebari[i].corect.toString()) {
        nrRaspunsuriCorecte += 1;
      }
    }

    res.render("rezultat-chestionar", {
      rezultat: nrRaspunsuriCorecte,
      intrebari: listaIntrebari,
      raspunsuri: raspunsuriUser,
      nume: numeUtilizator,
    });
  } else {
    res.redirect("/");
  }
});

app.post("/verificare-autentificare", (req, res) => {
  var index = -1;
  var ipAddress = req.ip; // Obține adresa IP a clientului
  console.log(ipAddress);
  var data = JSON.parse(JSON.stringify(req.body));

  if (blackList.includes(ipAddress)) {
    // Dacă utilizatorul se află în blacklist, blochează accesul la toate resursele
    res.status(403);
    res.send("Accesul este blocat temporar.");
    return;
  }

  for (var i = 0; i < listOfUsers.length; i++) {
    if (
      listOfUsers[i].utilizator.toString() === data.utilizator &&
      listOfUsers[i].parola.toString() === data.parola
    ) {
      index = i;
      break;
    }
  }

  if (index != -1) {
    deblocheazaUtilizator();
    req.session.utilizator = listOfUsers[i].utilizator.toString();
    req.session.nume = listOfUsers[i].nume.toString();
    req.session.prenume = listOfUsers[i].prenume.toString();
    req.session.email = listOfUsers[i].email.toString();
    req.session.tip = listOfUsers[i].tip.toString();
    req.session.produse = [];
    res.cookie("utilizator", listOfUsers[i].utilizator.toString());
    res.cookie("nume", listOfUsers[i].nume.toString());
    res.cookie("prenume", listOfUsers[i].prenume.toString());
    res.cookie("email", listOfUsers[i].email.toString());
    res.cookie("tip", listOfUsers[i].tip.toString());
    res.cookie("mesajEroare", "false");
    res.redirect("/");
  } else {
    console.log("Conectare esuata");
    if (
      typeof listOfFails[ipAddress] === "undefined" ||
      typeof listOfFailsLong[ipAddress] === "undefined"
    ) {
      console.log("Initializare short and long");
      listOfFails[ipAddress] = [1, new Date()];
      listOfFailsLong[ipAddress] = [1, new Date()];
    } else {
      var shortTime = (new Date() - listOfFails[ipAddress][1]) / 60000; //Math.floor(
      //   );
      var longTime = (new Date() - listOfFailsLong[ipAddress][1]) / 60000; //Math.floor(
      //  );

      console.log("Short: " + shortTime);
      console.log("Long: " + longTime);

      console.log("list e = " + listOfFails[ipAddress]);
      console.log("0 e = " + listOfFails[ipAddress][0]);
      console.log("Data1 e = " + listOfFails[ipAddress][1]);
      var date = new Date();
      console.log("Data = " + date);
      console.log("Diferenta :" + (date - listOfFails[ipAddress][1]));

      listOfFails[ipAddress][1] = date;
      listOfFailsLong[ipAddress][1] = date;
      if (shortTime <= 0.5) {
        listOfFails[ipAddress][0] += 1;
        console.log("Incrementare short " + listOfFails[ipAddress][0]);
      }
      if (longTime > 0.5) {
        listOfFails[ipAddress][0] = 0;
        listOfFailsLong[ipAddress][0] += 1;
        console.log("Incrementare long " + listOfFailsLong[ipAddress][0]);
      }
    }
    console.log("Short item " + listOfFails[ipAddress]);
    console.log("Long item " + listOfFailsLong[ipAddress]);
    if (listOfFails[ipAddress][0] == 3 || listOfFailsLong[ipAddress][0] == 2) {
      console.log(
        "Incercarea de conectare pentru utilizatorul " +
          data.utilizator +
          " cu adresa IP " +
          ipAddress +
          " a fost adaugat in blacklist "
      );
      blackList.push(ipAddress);
      listOfFails[ipAddress][0] = 0;
      listOfFailsLong[ipAddress][0] = 0;
      // Setează un timeout pentru a debloca adresa ip după o anumită perioadă
      setTimeout(deblocheazaUtilizator, 0.25 * 60 * 1000, ipAddress);
      return;
    }

    res.status(403);
    res.cookie("mesajEroare", "true");
    res.redirect("/autentificare");
  }
});
app.get("/logout", (req, res) => {
  req.session.nume = null;
  req.session.destroy();
  res.clearCookie("utilizator");
  res.clearCookie("nume");
  res.clearCookie("prenume");
  res.clearCookie("email");
  res.clearCookie("mesajEroare");
  res.redirect("/");
});

var created = false;

app.get("/creare-bd", (req, res) => {
  const text = `
        CREATE TABLE IF NOT EXISTS "produse" (
            "id" SERIAL,
            "nume" VARCHAR(100) UNIQUE NOT NULL ,
            "pret" INT NOT NULL,
            PRIMARY KEY ("id")
        );`;

  execute(text).then((result) => {
    if (result) {
      console.log("Table created");
    }
  });

  res.redirect("/");
});

let produse = [
  {
    nume: "Scaner documente",
    pret: 1200,
  },
  {
    nume: "Imprimantă multifuncțională",
    pret: 1500,
  },
  {
    nume: "Software de editare documente",
    pret: 500,
  },
];
app.get("/inserare-bd", (req, res) => {
  try {
    for (var i = 0; i < produse.length; i++) {
      client.query(
        `INSERT INTO "produse" ("nume", "pret")  
        VALUES ($1, $2) on conflict (nume) do nothing;`,
        [produse[i].nume.toString(), produse[i].pret.toString()]
      ); // sends queries
      console.log(
        "Produsul : " + produse[i].nume.toString() + " a fost inserat"
      );
    }
  } catch (error) {
    console.error(error.stack);
    return false;
  }
  res.redirect("/");
});

app.post("/adaugare_cos", (req, res) => {
  req.session.produse.push(req.body.id);
  res.redirect("/");
});
app.post("/vizualizare_cos", async (req, res) => {
  var numeUtilizator = req.session.utilizator;
  var listaIDProduse = req.session.produse;
  console.log(listaIDProduse);
  var produseSelectate = {};
  if (typeof listaIDProduse !== "undefined") {
    for (var i = 0; i < listaIDProduse.length; i++) {
      var produs = await getProdusById(listaIDProduse[i]);

      numeProdus = produs[0].nume;
      console.log(numeProdus);
      if (produseSelectate[numeProdus] !== undefined) {
        produseSelectate[numeProdus].cantitate++;
        produseSelectate[numeProdus].pret += produs[0].pret;
      } else {
        produseSelectate[numeProdus] = {
          cantitate: 1,
          pret: produs[0].pret,
        };
      }
    }

    produseSelectate = Object.entries(produseSelectate).map(
      ([nume, { cantitate, pret }]) => ({ nume, cantitate, pret })
    );
    console.log(produseSelectate);

    res.render("vizualizare-cos", {
      nume: numeUtilizator,
      produseleMele: produseSelectate,
    });
  } else {
    res.render("vizualizare-cos", {
      nume: numeUtilizator,
      produseleMele: produseSelectate,
    });
  }
});
app.get("/admin", (req, res) => {
  var numeUtilizator = req.session.utilizator;
  res.render("admin", { nume: numeUtilizator });
});
app.post("/inserare-bd-nou", (req, res) => {
  var data = JSON.parse(JSON.stringify(req.body));
  console.log(data);
  try {
    client.query(
      `INSERT INTO "produse" ("nume", "pret")  
        VALUES ($1, $2) on conflict (nume) do nothing;`,
      [data.produs.toString(), data.pret.toString()]
    );
    console.log("Produsul : " + data.produs.toString() + " a fost inserat");
  } catch (error) {
    console.error(error.stack);
    return false;
  }
  res.redirect("/admin");
});

const paths = [
  "/",
  "/favicon.ico",
  "/chestionar",
  "/autentificare",
  "/rezultat-chestionar",
  "/verificare-autentificare",
  "/logout",
  "/creare-bd",
  "/inserare-bd",
  "/adaugare_cos",
  "/vizualizare_cos",
  "/admin",
  "inserare-bd-nou",
];

app.get("/*", (req, res, next) => {
  var numeUtilizator = req.session.utilizator;
  var resursa = req.path;

  //console.log("Resursa " + resursa);
  // Verifică existența resursei
  if (!paths.includes(resursa)) {
    if (typeof listOfFails[numeUtilizator] === "undefined") {
      listOfFails[numeUtilizator] = [1, new Date()];
    } else {
      listOfFails[numeUtilizator][0] += 1;
    }
    console.log("Accesari ilegale :" + listOfFails[numeUtilizator][0]);

    if (listOfFails[numeUtilizator][0] == 3) {
      console.log(
        "Utilizatorul " + typeof numeUtilizator === "undefined"
          ? req.ip
          : numeUtilizator + " a fost adăugat în blacklist."
      );
      blackList.push(numeUtilizator);

      // Setează un timeout pentru a debloca utilizatorul după o anumită perioadă (de exemplu, 5 minute)
      setTimeout(deblocheazaUtilizator, 0.5 * 60 * 1000, numeUtilizator);
    }
  }
  res.redirect("/");
});

app.listen(port, () =>
  console.log(`Serverul rulează la adresa http://localhost:`)
);
