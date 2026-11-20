[00:00] Hi and welcome. On this lecture we are actually about to know or learn about how to use Redis database. But first we need to know some actually important things related to Redis database. Okay I've actually found this cool article which is mixed kind of comparison between Redis and MongoDB.
[00:29] but before all of this why what is the advantage that the Redis can give us when we use it for caching on our application the answer is very simple it is just one thing which is the simplicity and speed and speed focus on this speed why this actually the why this Redis is much much more
[00:56] faster than MongoDB and the answer here on this part. The key difference between MongoDB and Redis, it were displaced. Redis is actually a memory storage with desk persistence. But MongoDB, it is actually on the desk by default.
[01:24] not on the memory storage so the different here that gives to us it you know the RAM on your computer or on your machine as much as the RAM is fast or faster than the the desk is this is the different the same different between using Mongo and Redis I've also found this
[01:53] on chargeability which tells us that serve frequent request up to 10 to 100 times faster than MongoDB. So that's why we will use Redis for caching and why also we need to have kind of caching, okay? Let's just imagine that we started to
[02:20] deploy our application to the internet use it for everyone and now we have that famous person that may visit his page may visits or his post may seen by thousands or ten of thousands or hundred of thousands of people all the same times so this will actually
[02:48] push our MongoDB and our backend in general to the highest limit so instead of have of pushing or give all the tasks that can be repeated on a very small amount of time I just say 10 seconds instead of have of letting our MongoDB
[03:17] deal with all this we can actually use Redis to do this job at the same time we can keep and this is the key thing here why we are not using Redis for everything because it's actually depending on the RAM or the memory so this is mean that if for example if we restart our machine our server on a cloud we're all going to lose this
[03:46] most or all of this data actually but on MongoDB we save all this on the disk so nothing will happen when we refresh or restore our machines or our servers alright so that's why we are
[04:11] going to use Redis for caching, and that's also why we are using caching in general on such cases. Just imagine that we have an application just like AWS or Amazon, sorry, an application like Amazon or anything like that, and we have that item or product that visits by many people at the same time.
[04:40] we want a fast way and to rely on it to give our frontend or our end user that data as fast as we can and also we want this to be updated so we want to have kind of that called TTL or time to remove or forget okay
[05:10] Alright, we'll understand how this can be useful for us later on, but for now I just have kind of demo project to understand how can we deal with that. First of all, we can run or install Redis on our machine, but I actually prefer to run it via Docker desktop, so...
[05:39] all you can do is to come up here and say docker pull reds at enter this will use latest by default wait until the download is finished all right this is done now we need to run
[06:07] that on any instance we can name it redis-test-annistance for example just say docker run hyphen hyphen name redis just push this to another place okay that's cool redis-test-annistance
[06:36] and the default port for this is 6378 i just gave it the same port for exporting 6379 sorry not it
[07:03] at enter this will be running on the touch mode if we came now we are here on the containers here the image is actually in use on this container with that ID and on that name Redis test instance just check this out ready to accept connection TCP
[07:32] cool now we just open our project via vscode okay and i just start by add main dot main dot go start by add package sorry not main package
[08:01] Main All right next We need to store by say funk Main And the first thing we need to do is actually to
[08:30] to have a connection to our database if you just go back to the redis you can simplify in this how this actually connects so you can just copy this you can we can actually copy all of this and go on back just leave all this here
[08:57] okay we want to have the same address password 0 db 0 use default db okay connection protocol now just leave this to the default without added and we can simply come up here
[09:27] for example test the connection and just say ping an error all this will go to client ping for that who need the contacts so we can just define our contacts outside of here ctx all go contacts
[09:55] text background all right we can come up here on bang and then say pointer of redis options okay sorry i forgot oh no no no
[10:25] here we need to pass the contacts and then ask for the result ok, anything else? after that we can just check if error equal to now in that case we can just say panic and pass this error otherwise we can just say FMT
[10:55] println, already this connected and we can pass this pink result here okay just now say go mod to id I think we need to say go init already this
[11:24] unknown command okay uh we should say go mod sorry go mod init now we can just say go mod
[11:54] right now we need to run our app the error should disappear but this bank is not undefined in this capital P now just run our application
[12:24] go right this give us punk okay try client help auto mode okay this is works fine if we go back here I'm not sure if we will have have anything here on the instance check this out anyway it looked like that it is
[12:53] works fine since we got this response here all right and then what we will try to do is to save data with TTL meaning time to leave or forget okay I just start by say save data with TTL just make it 10 seconds
[13:23] okay just start by recall the error and then say client for that we can use set this expect the contacts and the first argument second argument it is the key user name 123
[13:50] and that user name is Ahmed. I just say 10 times time second and then we return an error so that you can check if error not equal to 0
[14:15] on that case we can say panic errors now we have cached this username or that data and I want to mention something very important here I just go back to the article that we already leave
[14:45] this one's here, which is the data modeling. On MongoDB we have personal binary JSON documents, but on dealing with Redis it is actually key value store. So we can just keyzone binary, save strings, wetlands up to 512
[15:14] megabyte and the values can be string and multiple data structures such as list, set, bitmap, hash okay the sure data sets is limited by the size of the available memory itself okay or else for the coring we
[15:37] calling documents by single or multiple keys, ranges, or text search. Okay, here on Redis we have key value queries only. So the idea here is that we want to deal only with things that have kind of unique
[16:07] user ID so that's how we can get the correct value using the correct key if this refer to something in your mind I think you are on the same page which is using the IDs for posts for user data etc for making its key anyway now after we cached we can print this we can just say fmt
[16:36] println cached username 123 okay which is Ahmad X in 10 seconds or X bars in 10 seconds very well
[17:01] now what we can do is to try to fetch this value just store by say val error me not 10 second is too much time just make this just five seconds that's cool and next we can just came up here and say client
[17:29] remember we use set this time we will use get okay ctx and what we want to to get is sorry user name 123
[17:58] okay we want to have a result for that now we have the value we can start by check for the error if this not equal to null fmt println key not found okay else
[18:28] On that case we can just say fmt, println, fetched, cached, value, and pass this well. Alright I think that's cool. Now let's just try to run our application.
[18:56] All right, that's great. We have cache name, user name. I don't think it is important to run this anymore. I just take it out. Okay, let's save.
[19:24] run this one more time all right we have this okay I think to ignore this issue we need to say protocol specify protocol to all right just run this one more time go around
[19:52] main.go, great, we cached the name and then we fetched the cached value which is Ahmed. Great. Next we want to test finally this TTL. I'll just try to do this. Okay, we want to wait till the check is exposed. We can just say time, sleep.
[20:20] for six seconds and in say time not second. After that we want to check the error directly we want to say this equal to client not get pass the contacts
[20:49] and search for the same username 123 and grab the result after the check every error not equal to no say fmt print ln after 6 seconds
[21:18] key explorer and pass this error, hit save I just run this one more time ok, this cache, wait 1, 2, 3, 4, 5, note, redis return null and the error here, not after 6 seconds
[21:48] We want to keep the data for the post that many users can see or can fetch from the backend at the same time.
[22:16] Let's just imagine that that post has been changed. Somebody add like, someone add comment to it. The creator of the post decided to change something. So we want our user to be up to date. So we cannot use this for big amounts of time. We can just use it maximum for 10 or 20 seconds.
[22:40] All right, I think that's all we can do on this lecture. We just now apply this on our application on the next lecture.
[22:47] you
