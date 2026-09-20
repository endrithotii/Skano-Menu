import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import bcrypt from "bcryptjs";

// Production users from the SQL file
const PRODUCTION_USERS = [
  { id: 1, name: 'Kastriot Ademi', email: 'kasstriott432@gmail.com', password: '$2y$10$gWP9MBx4EnyAc9Dft/XPZukoTioWLBzQq2G8IL3FMWCWc4BApzShq', business_name: 'Thronebar' },
  { id: 2, name: 'Bedri', email: 'nderi_99@hotmail.com', password: '$2y$10$c1zWhvXMg47LOblv1ppda.TdiiKRHvcaeqd7FbHI3uG.Eu8Z7dscW', business_name: 'Restorant Aroma' },
  { id: 4, name: 'Kujtim Selmanaj', email: 'bar10der2020@gmail.com', password: '$2y$10$vx.64Fcw1Bhdnoy1Wy7uHuJw5ZP.umAqQHrgt1hzhYG8UyPwzi7li', business_name: 'Bar 10der' },
  { id: 5, name: 'Donjet Ramadani', email: 'incoffeebar2013@gmail.com', password: '$2y$10$ZOvAcrBHME64Eq/hD6q4o.2f/smVhiAjGvYHALS0hiPPBDsQR5ZwO', business_name: 'IN COFFEE & BAR' },
  { id: 8, name: 'Flamur', email: 'shpija.e.vjeter@hotmail.com', password: '$2y$10$qju0SwvYTbiqluiRLjCvzOMxzkjY5OX8ehWLHP4.M8sFemJwT0yDm', business_name: 'Shpija e Vjeter' },
  { id: 9, name: 'Sadat Ibrahimi', email: 'sadat-ibrahimi@live.com', password: '$2y$10$Xs.x6JbFOhDLkZRNOFxTXuSw3Pl1pPAP30mOQxO/Vt.hxlJRDITwO', business_name: 'Serai' },
  { id: 10, name: 'Fidan', email: 'fidan0104@hotmail.com', password: '$2y$10$V.b7bolsktjEXC4cUEBa0.LV21jNDRVLY.YlBSeyZOhiU2pzotOoS', business_name: 'La Strada' },
  { id: 13, name: 'Valon Majanci', email: 'fatlum.rafuna@gmail.com', password: '$2y$10$ubVM7sc1a7MQas01HEtCA.PosR8zk/TbxhyMJv8nZV44.wumIGf9O', business_name: 'Creme de la Creme' },
  { id: 15, name: 'Safet Voca', email: 'azemhasani@hotmail.com', password: '$2y$10$zeEKgVCXDY2TbU.JXtrbS.UHS.4QIswqx.mFlm2P6T4ibO0yB7iNG', business_name: 'Lion' },
  { id: 16, name: 'Arben', email: 'arben.zejn@gmail.com', password: '$2y$10$N2kWlOX2LleQ4u6bb70NBeuXcQYFnoNZypY3f/bZkTcsNCQPRF7TK', business_name: 'Lips Caffe Ulpiane' },
  { id: 17, name: 'Arianit Miftari', email: 'albesematoshi@gmail.com', password: '$2y$10$DD8q0DsZquw7fCqxqDqpu.TLcU.EOgtRBMX5.5ZMa.xbqyrZ8seAu', business_name: 'RADIO LOUNGE BAR' },
  { id: 20, name: 'Flamur Bajraktari', email: 'flamurbajraktari@live.com', password: '$2y$10$wOZMSGeyOFhWy30XDZLoEeIxzFoTagTGcSTxJIa1tB15ThAMrr4nS', business_name: 'Restaurant Symphony' },
  { id: 22, name: 'Besnik', email: 'besi.qyqalla@hotmail.com', password: '$2y$10$wQsAI/SmT8awgAPddXR7Z.DZBMWY05s0jQqz7hBNO1g8xJ5.Sw8Oq', business_name: 'Corner Bar' },
  { id: 24, name: 'Ardi Oruqi', email: 'arberk1996@gmail.com', password: '$2y$10$Ba1OHmP1ujpO5Qz1nTwkD.vsGKKEckQxgzoaOAC7MxfaBlpdzaXCe', business_name: 'Sante Shisha Bar' },
  { id: 25, name: 'Bekim Maloku', email: 'bekuu@live.com', password: '$2y$10$3U/ybXgC9Lzmb6xB9aN70OiW8zSoYF9N65t1WUHgwPyWAxfaEJJxq', business_name: 'FastFood Beka' },
  { id: 28, name: 'Ardit', email: 'primabakeryshop@gmail.com', password: '$2y$10$GgxoWPRtY0IWeYcznDOJs.029eWQY8MotKZiP3zP1T4odDlK3iZTu', business_name: 'Prima bakery & coffe shop' },
  { id: 29, name: 'Zijadin Arifi', email: 'zassgroup@outlook.com', password: '$2y$10$Jt7yDvWpnYEiuBlHhVdWkuijLGZBlMRI/nC3kBNrs5yuF3KGBqkyu', business_name: 'Taverna Simfonia e Arrave' },
  { id: 30, name: 'Arben', email: 'restaurant.trattoria@hotmail.com', password: '$2y$10$N.7pUO0wScwAf519GkB4ZOBcqHHG.LbdNab06KVAaH7eBiwDwaseS', business_name: 'Restaurant trattoria' },
  { id: 31, name: 'Katriot Uka', email: 'al.besa1@hotmail.com', password: '$2y$10$O7vYMYjZGyda1adC5KtS7OZCL0o7P5xvZNbpc4F7240mqa2bXFHiq', business_name: 'Bells Terrace' },
  { id: 34, name: 'shkurta cakaj vataj', email: 'hamitgashi34@gmail.com', password: '$2y$10$vx.64Fcw1Bhdnoy1Wy7uHuJw5ZP.umAqQHrgt1hzhYG8UyPwzi7li', business_name: 'Restaurant Fshati' },
  { id: 35, name: 'enis ajazaj', email: 'enisajazaj74@gmail.com', password: '$2y$10$DD8q0DsZquw7fCqxqDqpu.TLcU.EOgtRBMX5.5ZMa.xbqyrZ8seAu', business_name: 'Street B' },
  { id: 36, name: 'Nexhat Islami', email: 'kreshnikshala222@gmail.com', password: '$2y$10$Y6M2AuHSMY930Awvzf5Klu0VDsV20fjsKYwrq0V4HrGZ9OqMKZBHi', business_name: 'Friends Avenue' },
  { id: 42, name: 'Driton Rexhepi', email: 'sunnyhill.caffe@gmail.com', password: '$2y$10$dgP.va5IPi/cI3oCahlotOedlOxw8qiFh8ezmxM8IsAV09HSInw5m', business_name: 'Sunny Hill' },
  { id: 43, name: 'Florim Metolli', email: 'iamavdylk@gmail.com', password: '$2y$10$DD8q0DsZquw7fCqxqDqpu.TLcU.EOgtRBMX5.5ZMa.xbqyrZ8seAu', business_name: 'Restaurant Villa Pikniku' },
  { id: 45, name: 'Fisnik Kurti', email: 'dadaprishtine@gmail.com', password: '$2y$10$EevPZQlRNAsWceG4v6YF2eHF/LpU.bQVtKi7Ju1l.2jAgnPOqYZna', business_name: 'Dada eat & drink' },
  { id: 46, name: 'Blendi Ahmetaj', email: 'blendi.esim@gmail.com', password: '$2y$10$oQatq4865y7R0iE.WwB2CuMhLtckGF4PbiRlpbv7GleKWjsVfsxBu', business_name: 'Placebo Lounge & Shisha Bar' },
  { id: 48, name: 'Lorik', email: 'morenabar1996@hotmail.com', password: '$2y$10$nxvTpimo33ufOfDxsiAeS.dhjyyK74XKGycq0phwo6vX9Rqh7nOEW', business_name: 'MorenaBar' },
  { id: 49, name: 'Agron', email: 'restaurantgoldroom@gmail.com', password: '$2y$10$29RyzG6ooW7qIqQDmjBkOeGBfJjBD25u.DAaFACenzsH45tp525Ru', business_name: 'Gold Room' },
  { id: 50, name: 'Leotrim Regaliu', email: 'egzon.duca@gmail.com', password: '$2y$10$7mfmgGlvJbQVGLK.MeERwuWrY.WKa9lCppC0rxrEV2J/ZFdmDQL46', business_name: 'Oh My Bar & Lounge' },
  { id: 51, name: 'Salih Gjinovci', email: 'greenterraceshpk@gmail.com', password: '$2y$10$Qotb0F5ROKNtw6j.3GWUteWJEei8J4pWOTQJAvUntE2E3MnOmv0p6', business_name: 'Green Restaurant' },
  { id: 53, name: 'Albese', email: 'kuzinatradition@gmail.com', password: '$2y$10$jSxsfLMPwtkoGo2wRZztWucvOyKwB1eHFM4RmT1xQuK3p8D2iAtWq', business_name: 'Kuzina Tradition' },
  { id: 54, name: 'Gyner Ismaili', email: 'rockhousegjilan@gmail.com', password: '$2y$10$OtSO0dbZ61jVt03hzK7iDeyd92lrR9h10OjLhAVd3zHcQWYiCS4ce', business_name: 'Rock House' },
  { id: 55, name: 'Golden', email: 'kerkushiaskushii@gmail.com', password: '$2y$10$pFokGwI24FKyTbhiI.oSOutmpsdDNHfoNPlWtSOZGU2SYXHLE7Dr.', business_name: 'GoldenRestaurant' },
  { id: 57, name: 'Ahmet Bylykbashi', email: 'ahmetbylykbashi1@gmail.com', password: '$2y$10$rp75API3FdlUUpTHniOL.ufPdWMJrYRyh03.7f2S.VnLrhIcGFlZS', business_name: 'Krip e Zemër' },
  { id: 60, name: 'Albenis', email: 'artramizii06@gmail.com', password: '$2y$10$DD8q0DsZquw7fCqxqDqpu.TLcU.EOgtRBMX5.5ZMa.xbqyrZ8seAu', business_name: 'Submarines' },
  { id: 62, name: 'Ejmen', email: 'pointpizza037@gmail.com', password: '$2y$10$Kmn8sNYGybOr7MkPO4TFmu5mCahs2VqBK9.zr1es98/1s.mOD/Maq', business_name: 'Pizza Point' },
  { id: 64, name: 'Burim', email: 'baronexclusive@gmail.com', password: '$2y$10$CvNFmOlVV4eKaxhkhNV4juxCAyXK6WxQyY2xwhiQ0Uii4jtxZXqTC', business_name: 'BARON Exclusive' },
  { id: 71, name: 'Nexhmedin Kolshi', email: 'info@aviano-hotel.com', password: '$2y$10$GzvUqUGpZskrHlm.dG6qNOeyRANkLbcY71uLQeWMTBrAWE0Fc5X96', business_name: 'Aviano Restaurant Hotel' },
  { id: 72, name: 'Lenti', email: 'flora@gmail.com', password: '$2y$10$8wIxkml4Z9xvSBZmmhND/OXojh4pJIdGam5vf9CwDNBQahK1.EEz6', business_name: 'Restaurant Flora' },
  { id: 74, name: 'Arijon', email: 'arijonjonuzi@gmail.com', password: '$2y$10$ewGPUdmdjX094HTkeuy1QeNCN4wTpxnZEdxe98hday9h5j03BR3BW', business_name: 'Hemingway Coffee and More' },
  { id: 75, name: 'Hera', email: 'marketing@hotelsirius.net', password: '$2y$10$nIt22PQw9IH.HmjcseDwu.nPl7obi.2CzTBqci5kQDtWdUHxvlasm', business_name: 'Hera Roof Top' },
  { id: 78, name: 'Adnan', email: 'jeton000@hotmail.com', password: '$2y$10$WYB3FLhCIP0ROUcZGp7nruKFkQ0RMmiM1mhE47uUj4RKouDGuUBhO', business_name: 'Restaurant Piceria Adi Caffe' },
  { id: 79, name: 'Gazmend Mulliqi', email: 'kosovapro1@gmail.com', password: '$2y$10$82TghzyniqzqV8QQXj1u0ujaXnzYYJ.zucgV4cE819pCrkHIKRyeu', business_name: 'Pizzeria Melisa' },
  { id: 80, name: 'Burbuqe Bajraktari', email: 'hotelgardenrks@gmail.com', password: '$2y$10$IMGKmWK25yq4czfkxn4eXu7pBN20Yp0byec7Y.287huzpgWOn1GDu', business_name: 'Hotel Garden' },
  { id: 81, name: 'Dren', email: 'lili.rozafa@hotmail.com', password: '$2y$10$8mflQRlJbI6cAC1hjXu28emdWM.1UtAb1x0iB1vWYerdE6Yega0XW', business_name: 'Rozi Lounge Bar' },
  { id: 82, name: 'Hamari', email: 'restauranthamari@hotmail.com', password: '$2y$10$nvmXPXxGORcnoYpI9.0mseWj48QUQLh5YdwjCR4LK7bTk6F.J4LFu', business_name: 'RESTAURANT HAMARI' },
  { id: 83, name: 'Oltion Haziri', email: 'restaurantbaresha@gmail.com', password: '$2y$10$cYnZxo4Cy6njktzdqJWixewbJlxxT4Y5QXVWQ0Z0rUMXS/zYdVTla', business_name: 'Restaurant Baresha' },
  { id: 86, name: 'Albenis', email: 'albenisazemi6@gmail.com', password: '$2y$10$EdVBep8CPKQlBgbupklqmO3WctNN.CfMajA0grMer3tyDw/Xh8lge', business_name: 'Rockin\' Subs Gjilan' },
  { id: 87, name: 'Petrit Kllokoqi', email: 'kllokoqipetrit@gmail.com', password: '$2y$10$QHpanI/kxvmIDMIE7DTBc.zSrxZiVhmxIydokwE4da.pmfkbM3kGK', business_name: 'Bagolina' },
  { id: 88, name: 'Minimax', email: 'mm.marketing887@gmail.com', password: '$2y$10$v/UAyMVOvoTIXOESnvePXOy3zGDkY4XhSj6J9ZgWKQNPsMfhaI/eK', business_name: 'Priview Bar & lounge' },
];

// Production restaurants (menus) mapped to owners
const PRODUCTION_RESTAURANTS = [
  { owner: 1, name: 'Thronebar', slug: 'thronebar', address: 'Aktash, rr. Lord Bajroni nr. 9', phone: '048800401' },
  { owner: 2, name: 'Restorant Aroma', slug: 'restorant-aroma', address: 'Te lesna', phone: '044211884' },
  { owner: 4, name: 'Bar 10der', slug: 'bar-10der', address: 'Rruga B', phone: '049444644' },
  { owner: 5, name: 'IN COFFEE & BAR', slug: 'in-coffee-bar', address: 'Rr.Eqrem Qabej', phone: '049614961' },
  { owner: 8, name: 'Shpija e Vjeter', slug: 'shpija-e-vjeter', address: 'Rr. Qamil Hoxha - Prishtine', phone: '045840084' },
  { owner: 9, name: 'Serai', slug: 'serai', address: 'Qamil Hoxha nr.27', phone: '049802502' },
  { owner: 10, name: 'La Strada', slug: 'la-strada', address: 'Qamil Hoxha, nr.19', phone: '045505105' },
  { owner: 13, name: 'Creme de la Creme', slug: 'creme-de-la-creme', address: 'rr.Qamil Hoxha', phone: '045101044' },
  { owner: 15, name: 'Lion', slug: 'lion', address: 'Imzot Nikprelaj, Ulpiane', phone: '044347012' },
  { owner: 16, name: 'Lips Caffe Ulpiane', slug: 'lips-caffe', address: 'Bulevardi i Deshmoreve, 23/8, Ulpiane', phone: '045704010' },
  { owner: 17, name: 'RADIO LOUNGE BAR', slug: 'radio-lounge-bar', address: 'Bulevardi i Deshmoreve, Ulpiane', phone: '044163282' },
  { owner: 20, name: 'Restaurant Symphony', slug: 'restaurant-symphony', address: 'Ulpiana C7/1', phone: '038548271' },
  { owner: 22, name: 'Corner Bar', slug: 'corner-bar', address: 'Rruga Idriz Gjilani', phone: '048777209' },
  { owner: 24, name: 'Sante Shisha Bar', slug: 'sante-shisha-bar', address: 'Prishtinë, Rr.Bulevardi Bill Klinton Nr.107', phone: '045293907' },
  { owner: 25, name: 'FastFood Beka', slug: 'fastfood-beka', address: '20qershori', phone: '049533157' },
  { owner: 28, name: 'Prima bakery & coffe shop', slug: 'prima-bakery', address: 'Rr. 28 Nëntori - Skenderaj', phone: '049777688' },
  { owner: 29, name: 'Taverna Simfonia e Arrave', slug: 'taverna-simfonia', address: 'Rr.Mark Raka, nr.12', phone: '045401077' },
  { owner: 30, name: 'Restaurant trattoria', slug: 'restaurant-trattoria', address: 'Fadil vata', phone: '045682700' },
  { owner: 31, name: 'Bells Terrace', slug: 'bells-terrace', address: 'Pejton, mbrapa Katedrales 10000 Pristina, Kosovo', phone: '049600699' },
  { owner: 34, name: 'Restaurant Fshati', slug: 'restaurant-fshati', address: 'Rr. Bardhyl Çaushi, mbrapa rruges B', phone: '049219000' },
  { owner: 35, name: 'Street B', slug: 'street-b', address: 'Rruga B', phone: '045112277' },
  { owner: 36, name: 'Friends Avenue', slug: 'friends-avenue', address: 'Rruga B', phone: '049194500' },
  { owner: 42, name: 'Sunny Hill', slug: 'sunny-hill', address: 'Rr. Xheladin Hana', phone: '045966155' },
  { owner: 43, name: 'Restaurant Villa Pikniku', slug: 'restaurant-villa-pikniku', address: 'Matiqan', phone: '044687068' },
  { owner: 45, name: 'Dada eat & drink', slug: 'dada-eat-drink', address: 'Rruga B', phone: '049777448' },
  { owner: 46, name: 'Placebo Lounge & Shisha Bar', slug: 'placebo-lounge', address: 'Rruga Lidhja e Prizerenit, Nr.101', phone: '043571515' },
  { owner: 48, name: 'MorenaBar', slug: 'morena-bar', address: 'Rr Motrat Qiriazi', phone: '049833555' },
  { owner: 49, name: 'Gold Room', slug: 'gold-room', address: 'Arberi rr. Ferid Curri, 143, Prishtine, Minimax', phone: '044491300' },
  { owner: 50, name: 'Oh My Bar & Lounge', slug: 'oh-my-bar', address: 'rr.Fehmi Agani, Prishtine', phone: '0' },
  { owner: 51, name: 'Green Restaurant', slug: 'green-restaurant', address: 'Rrustem Statovci , nr 1', phone: '045651888' },
  { owner: 53, name: 'Kuzina Tradition', slug: 'kuzina-tradition', address: 'Rruga B, Rr. Muharrem Fejza', phone: '386 43 711 211' },
  { owner: 54, name: 'Rock House', slug: 'rock-house', address: 'Beqir Musliu 9 Gavran 1,Gjilan', phone: '44408305' },
  { owner: 55, name: 'GoldenRestaurant', slug: 'golden-restaurant', address: 'Kamenicë', phone: '45969606' },
  { owner: 57, name: 'Krip e Zemër', slug: 'krip-e-zemer', address: 'Rruga B, kompleksi Lin Projekt', phone: '044740442' },
  { owner: 60, name: 'Submarines', slug: 'submarines', address: 'Gjilan', phone: '048892464' },
  { owner: 62, name: 'Pizza Point', slug: 'pizza-point', address: 'Gjilan', phone: '46123321' },
  { owner: 64, name: 'BARON Exclusive', slug: 'baron-exclusive', address: 'Gjilan', phone: '049370340' },
  { owner: 71, name: 'Aviano Restaurant Hotel', slug: 'aviano-restaurant', address: 'Sllatine, Fushe-Kosove', phone: '044111633' },
  { owner: 72, name: 'Restaurant Flora', slug: 'restaurant-flora', address: 'Rr. Rilindja Kombetare -Malisheve', phone: '49335307' },
  { owner: 74, name: 'Hemingway Coffee and More', slug: 'hemingway-coffee', address: 'Prizren , Shatervan', phone: '043955159' },
  { owner: 75, name: 'Hera Roof Top', slug: 'hera-roof-top', address: 'Rr. Agim Ramadani, Hotel Sirius, Prishtinë, 10000', phone: '38345418602' },
  { owner: 78, name: 'Restaurant Piceria Adi Caffe', slug: 'restaurant-adi-caffe', address: 'Vladimir', phone: '069634107' },
  { owner: 79, name: 'Pizzeria Melisa', slug: 'pizzeria-melisa', address: 'Rruga Jashar Salihu, Prishtinë', phone: '043900772' },
  { owner: 80, name: 'Hotel Garden', slug: 'hotel-garden', address: 'Agim Çela No.1, 10000 Pristina, Kosovo', phone: '0' },
  { owner: 81, name: 'Rozi Lounge Bar', slug: 'rozi-lounge-bar', address: 'Suharekë, Kosovë.', phone: '049893372' },
  { owner: 82, name: 'RESTAURANT HAMARI', slug: 'restaurant-hamari', address: 'Germia, Butovc 130', phone: '044891500' },
  { owner: 83, name: 'Restaurant Baresha', slug: 'restaurant-baresha', address: 'Pasjak, Gjilan', phone: '44151159' },
  { owner: 86, name: 'Rockin\' Subs Gjilan', slug: 'rockin-subs', address: 'Gjilan', phone: '044892464' },
  { owner: 87, name: 'Bagolina', slug: 'bagolina', address: 'Rr. Ali Pashe Tepelena 15', phone: '0' },
  { owner: 88, name: 'Priview Bar & lounge', slug: 'priview-bar', address: 'Rr. Ferid Curri 143', phone: '044 478 478' },
];

export async function GET(request: NextRequest) {
  return Response.json({
    message: "POST to import production data",
    totalUsers: PRODUCTION_USERS.length,
    totalRestaurants: PRODUCTION_RESTAURANTS.length,
  });
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("x-init-token");
    if (process.env.INIT_TOKEN && token !== process.env.INIT_TOKEN) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adapter = new PrismaLibSql({
      url: process.env.DATABASE_URL!,
      authToken: process.env.DATABASE_AUTH_TOKEN,
    });
    const prisma = new PrismaClient({ adapter } as any);

    console.log("[PRODUCTION_IMPORT] Starting production data import...");

    let userCount = 0;
    let restaurantCount = 0;
    const errors: string[] = [];

    // Import users
    for (const user of PRODUCTION_USERS) {
      try {
        const existing = await prisma.user.findUnique({
          where: { email: user.email },
        });

        if (!existing) {
          await prisma.user.create({
            data: {
              email: user.email,
              password: user.password, // Already hashed from production
              name: user.name,
              role: "MANAGER", // Default role
            },
          });
          userCount++;
          console.log(`[IMPORT] Created user: ${user.email}`);
        }
      } catch (e: any) {
        errors.push(`User ${user.email}: ${e.message}`);
      }
    }

    // Create a map of old user IDs to new user IDs
    const userMap: Record<number, string> = {};
    for (const user of PRODUCTION_USERS) {
      try {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
        });
        if (dbUser) {
          userMap[user.id] = dbUser.id;
        }
      } catch (e) {
        // Ignore
      }
    }

    // Import restaurants
    for (const resto of PRODUCTION_RESTAURANTS) {
      try {
        const ownerId = userMap[resto.owner];
        if (!ownerId) {
          errors.push(`Restaurant ${resto.name}: Owner not found (old ID: ${resto.owner})`);
          continue;
        }

        const existing = await prisma.restaurant.findUnique({
          where: { slug: resto.slug },
        });

        if (!existing) {
          await prisma.restaurant.create({
            data: {
              name: resto.name,
              slug: resto.slug,
              description: resto.name,
              address: resto.address || "Address not specified",
              phone: resto.phone || "Not specified",
              ownerId: ownerId,
              status: "ACTIVE",
              email: "info@skano.menu",
              cuisine: JSON.stringify([]),
              logo: "",
              coverImage: "",
              website: "",
            },
          });
          restaurantCount++;
          console.log(`[IMPORT] Created restaurant: ${resto.name}`);
        }
      } catch (e: any) {
        errors.push(`Restaurant ${resto.name}: ${e.message}`);
      }
    }

    await prisma.$disconnect();

    console.log(`[PRODUCTION_IMPORT] ✅ Completed. Users: ${userCount}, Restaurants: ${restaurantCount}`);

    return Response.json({
      success: true,
      message: "Production data imported",
      usersCreated: userCount,
      restaurantsCreated: restaurantCount,
      totalProduction: {
        users: PRODUCTION_USERS.length,
        restaurants: PRODUCTION_RESTAURANTS.length,
      },
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error("[PRODUCTION_IMPORT] Error:", error);
    return Response.json(
      {
        error: "Import failed",
        message: error.message,
      },
      { status: 500 }
    );
  }
}
