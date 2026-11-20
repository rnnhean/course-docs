[00:00] So, in this tutorial, we will configure lockstash and filebit and select lockflushing filebit pass those lockflushing lockstash. So, for running lockfilebit, I will be using this Udemy server which has Elasticsearch and Kibana running and I will use this bit server to configure the lockstash. So, where we have previously deployed Metricbit and Adbit. Okay. So, let's first download the packages.
[00:29] So, we will search for download file bit, download file bit and we will check for download graph set ok. Let us go to the first link for both ok. As you can see it is file bit is of 9.3.4. So, let us make the practice copy link.
[00:57] and on the this udm server which is having elastic search and I will download this in data day same I will do for this Oxtas this is also 9.3.4 version let's select the package you will download on this server we are in
[01:26] in this god is connected. Let us create open new session. I will connecting using this frame piece.
[01:53] This is hosted on AWS SQL instance. So we will go to data. Here we will download the blockstash.
[02:20] okay now loxus is being downloaded so let's configure the 5 bit first so as we can see we have downloaded this found bit let's extract this it was extracted let's delete this
[02:50] see we have deleted before configuring file bit we will create a folder or directory where we will store all the logs for time be we will create one directory sample underscore locks okay so we will go to that sample underscore locks directory
[03:19] and we will create one log file for that I will take apache server sample logs okay so I have this first website we will move to that website up with this logs from this website so which has basic fields this is the single log line as you can see
[03:49] which has this IP then this timestamp then this is the URL over here and this is the status code and this are the bytes so let's copy from here and let's create a log file demo lot log paste all the logs in that file just save this file
[04:18] just copy path location of this file so let's go to the file bit directly so we have these files okay so this is this is a file used to configure the file bit yaml ebana folder so all the bytec folder of course so let's configure the file bit okay so now we will configure the file bit yaml
[04:48] So let's go to coil grid directly. Let's edit this coil grid here.
[05:17] let's edit this file so first this is the input section where we need to enable this input so that file bit can have access to the path location where logs are stored so we will make this group okay after that you need to enter the log path we are having logs in data data we have this sample logs
[05:46] directly in that we have this locks okay this is the file name we have demo dot locks so any name ending with dot locks extension will be captured by this file bit okay after that let's see what we need to configure okay scroll down
[06:15] if you want to set up the default dashboards then you can set up over here for that you need to enable this and set up dashboard as a true same like we have done in method bit so we need to provide the hostname for this
[06:41] Let me copy the IP address This is the hostname for that Kibana After that if you have the Elastic Cloud if you want to send logs to Elastic Cloud then you can use this output section for Elastic Cloud
[07:10] if you want to send logs to elastic search you can do this output section so as of now we are not sending to elastic search we are sending to our log step so we will comment this comment this and comment this okay after that we will enable this section so that we we can
[07:39] So let's set up lockstress.host so it will be running on another server so let's mention its IP address so we are going to run lockstress on this server so let's take the private IP of that server just paste over here so we will
[08:09] not configure AD certificate for lockstas so let's keep only the port number and the IP address and if you want to enable the logging for this file bit you can enable that also so that's it in file bit configuration so let's save this okay so we are in same registry where we have all the files
[08:38] so we can test this whether our file bit configuration is working correctly or not for that we need to make some changes in this okay so let's take the path okay this is the path where we have this configuration files so let me
[09:03] replace this over here let's see whether we have correct command so this ensures that all the config which we have configured
[09:28] still we are getting the error unknown command
[09:56] let me see why it is getting this is trying to this loser is not there that is trying to with that loser we can copy from here to here otherwise we can copy only this
[10:26] okay as you can see we have copied only this part and it says that our configuration change is that we have done in the filebit.aml is correct like that way we can check for test output so let's copy this and same as you can see
[10:55] it is saying that connection repos it will say like that only because still now we have not configured any lockstash over here so let's configure lockstash so we are done with the configuration and we are trying to connect with that lockstash but still not is running that's why you are getting this error so let's see after configuring whether this error is there or not so
[11:23] we have downloaded lockstrips on this server so let's unzip it this is the it address of that server where we know configure lockstrips just paste over here here we will open it this is the tool user select the pamp key
[11:53] okay let's name this instance okay let's go to data directory let's unzip this slopstab file okay
[12:19] We need to have solo permission for this.
[12:49] we will demo this let's see okay so we will go in this clock side directory okay it works as you have multiple holders over here as you can see the bin config and that kind of stuff so let's go to config
[13:18] ok so we have some sort of configuration files over here ok so we are in this type tree so what I will do I will make an demo.config we will name this as a demo.config you can use as a config or you can use console so let's paste over here let's for time being save this file
[13:47] okay so what I have saved in this file I will explain you over here so we know that lockstash has three plugins first one is input plugin second one is filter plugin and last one is the output plugin so what happens whenever lockstash receives data it receives in this from where it will receive it is defined in this input plugin so
[14:16] Right now this is the plugin which we have lived as a beats apart from which we have different types of inputs which can be used in lockstash or like if you are want to harvest get data from any SQL database you can use the JDBus plugin over there if you want to get data from Kafka then Kafka plugin is there then if you want to get data from your local source where the lockstash is running then you can use the file plugin so likewise
[14:45] So, this is the 5 euro double port is the default port for the lockstash. So, we are getting data from the paste official bits. So, that's why we are using this bits plugin. And we are going to receive this data on 5 euro double port. So, this is about input section. So, next section is the filter section. This is where lockstash works. This is the main configuration for lockstash works. As we know that lockstash is used to parse the data.
[15:14] means do the modification ok so we usually we get the logs ok json data xml data or csv data so we have those kind of filters available what to be used in this filter section so as we are going to harvest the logs so that's why we are using this croc pattern to match this log so let this is the croc filter it will match the this message field
[15:43] in grog filter we define the pattern how our logs are there so which which will break those unstructured logs into structured format and fill key value pair you can see and this this grog is not able to match the log lines are not match with this logs then we will get this grog pass failure tag over there and we are converting breaking the log line into sub fields like this client and that
[16:11] this STDP date and this method then this request these are the surplus which will be breaking down from the log lines so those are then for the parsed for parsing so we are using this muted filter in muted we are using this convert so we are converting the status as a integer we are setting this status as a integer and this bytes as a integer which are
[16:40] in the last section where here you can see apart from that we are using this date filter to match the timestamp so as you can see this is the timestamp so we need to match this time date okay so in logs suppose you have sredes date and you want to pass those laws in sredes time duration while storing into elastic that time you need to use this date filter
[17:07] so we are getting this timestamp file we are mapping how the date is stored in this timestamp file and then sending this new map timestamp file to the address timestamp file and this is the default timestamp file which is used by elasticsers after that if the status code is 401 we are set adding one tag on authorize.exe then the client IP is present then we are setting this
[17:36] storing this in GUI paper again we are using this muted field to remove this original message field and the timestamp okay and after that we have this third section which is nothing but output plugin where we configure where we need to send the data okay so for now we will be sending data to elastic search so let us configure in that way so our elastic search is in this server
[18:05] So let me copy the address of that server. Let us edit this file. Okay, let us paste the username. Let us paste the password. Okay, you are setting this SSL as a pro. So we need to provide the path.
[18:34] for this SSL certificate certificate so let's see where we have this SSL certificate so we have we are going to deploy in this server so
[18:48] Let us connect to this all across.
[19:10] So let's copy CA-SERT from this
[19:36] data directory we can use sudo for this as you can see we have copied the certificate over here so let's paste that also we are having certain
[20:03] okay and we will name our index as well this will be our index name and yeah it will have the timestamp for each an index so at when proves data is in this state
[20:30] So, we can set a role over for this also. So, this is a configuration file which we have configured. So, let's copy this. Let's edit YAML configuration which we have made earlier.
[20:58] okay let's paste this save this once again okay so let's see okay we have this demo.com let's add as you can see we have configured all the details we have been the certificate path and that kind of stuff so let's execute this
[21:22] for example in this we have this okay we have in data directory we have first this this is the directory name and we have demo.conf okay
[21:50] is a file configuration file path and we will copy it from here and as you took over here dot slash this space after that we are configuring the path where our public file is running so let's press enter it says dot of search not okay okay so why it is not fine finally
[22:19] it is in bin okay so the lock sign has started as you can see this config file usually is present in bin file bin directory so it will start in like this way so it will take some time to start
[22:46] okay so we got an error okay cannot run as a super loser okay so let's do one thing you will create one another loser for this so let me open this hard bit camera let us copy this data
[23:12] and create one loser I replace this word here or here here
[23:39] we will add this user, after that we will give permissions, let's see, okay, permission offset, we will walk into the user, save the stash, data, box stash,
[24:07] we can go to the build directory or we can execute this from here also up so we will use this go run this enter so now blockstretch will start
[24:35] let's do it for some time so it gets started okay as you can see lock set has started again we got another error we scroll up lock set agent executioner in no longer available
[25:04] So, we have one deprecated setting over here which is this one SSL Pro.
[25:33] Let's copy okay let's use this instead of using this okay our certificate is located in this data directory
[26:02] let's remove this it is deprecated this happens okay because I am running this lockstash this latest version of lockstash purpose frame so let's use like this way we are demo.config erase this is the new configuration changes which has this SSL
[26:31] cell duplication authorities the deprecated symbol we have replaced with new one and let's run once again and check whether we are getting same issue or we have result ratio whenever you are dealing with file bit or lockstice we will test some issues like this so it's okay to
[26:59] get error so it depends how you solve those errors again we got errors what is the new error whenever you are looking for error here you are having info info info here you are having this block in morning then again info and again error okay so now it is
[27:28] Same, well done.
[27:45] okay so in output section we have some issue so let's say why we are having
[28:09] so we will after that, once again, we'll start with the blue
[28:33] ok so to paste this config file we will use this test config which we did in this our file bit will check whether
[29:01] It is running or not testing our configuration file also.
[29:20] So, we will copy this and I must using setGPT or something AI action.
[29:48] Sometimes we get issue and sometimes we need to diagnose that. This is how you can do. So let's see why it is getting issue. Let's test the configuration file also.
[30:15] ok ok ok so it there is a typing mistake in this that we are getting this before so let's see ok it should be like this ok I think this will be fine
[30:44] lets edit once again lets run this so this is how sometimes we make silly mistakes
[31:12] So we copied this line from the hardbit configuration where we have written hardbit.aml so we just copied and pasted and just changed the path but here the syntax will be like this so we did not do that that's why I incorporated and again it's failing so let's copy this once again okay and just I must
[31:41] what why it is telling once again let's paste the configuration file also okay there is another syntax error like okay the line is invalid okay okay but earlier
[32:08] This line was also given by the doctors. Okay. Let's say use this. Okay, let's use this.
[32:31] Let's copy this.
[32:49] Let's turn the pipeline once again.
[33:09] Now the agent has built properly but I think again it is getting issue with this CA.sir so it may be the permission related issue
[33:38] Let me do permission to not say cert cert in the feed
[33:57] Let's start.
[34:27] C A dot cert was not I will permission that's why it was telling I think. So let's check. So I have given permission to this rockstar user or C A dot cert. So let's check whether it will run or tell.
[34:50] but here it is saying that it is running on again print so set see
[35:15] where it is CA dot cert, the setting CA dot cert in Plavinelastic cert is observed, no longer available, set SSN certificate or certificate. Please copy this and ask AI what is the solution for this.
[35:40] so we have already used this but same issue but again we will try to change okay we had not included this in past black sprite was there in it maybe that that that may be the case
[36:05] Let's edit once again I have saved the current changes which are like
[36:32] last time we have added this we have made this in this but for what we have raised this so again I have added that and let's see whether it will start or not so we have started the lockstress see whether it will run successfully or it will again fail again it is failing
[36:57] Next up it is...
[37:24] Again it is saying that instead of SSL you will use SSL enabled. Okay let's try that also. So in your version you will get this issue. When I used to use this lockstash I used to have that older one. So now also I am trying this code first time and I am facing this issues.
[37:54] so you can also learn how we can fix these issues once these output sections works then you need to modify the filter section only for your different ads for pipeline that also we will see in next five tutorials so how to harvest CSV data and that kind of stuff
[38:21] ok as you can see we are say we have solved the issue clock says output connected to ES instance as you can see ok it has started the pipeline ok and the starting the input listener is also started pipeline also started and as you can see this is the last log line
[38:50] So, whenever you start the logstress starting the server on 50444. So, let's go to this tab where we have this kibana. So, let's check whether right last time we were getting the issue whenever we were running the output. Let's log into the server.
[39:19] okay so the worst file give data and to plus plus this this and chip flash time whenever we did this output test we got error we were not able to connect server connect to this software server but now we are not having this errors
[39:49] because our lock this lock just is running so let's start file bit ok boxless file bit that's good ok so we have started so we are passing this SSM certificate issue over here
[40:18] So let's again modify the YAML file So here we need to provide the SSL certificate path In dashboards So it is spelling over here So let's copy
[40:47] the path. This is the line if you need to give over here, but path will be different. Let us duplicate this tab and check whether
[41:14] where our certificate is flying in kibana in kibana we have the search folder in concrete we have search software these are kibana certificates let's go to the data ballistic search
[41:42] in that config, in that certs, in that CA. CA looked at it over here only. I will copy this part.
[42:03] and paste over here okay this is the auth for CA cert and we will start file bit once again again it is fairly build to get Kibana version
[42:30] why it is really if it is not able to get the Kibana version so
[42:54] ok we are getting some issues ok this is this looks good ok instead of installing default dashboard we can disable this ok
[43:23] If we are not using this then it's okay because we used logs to create custom dashboards. This is the biodec called dashboards and as you can see after commenting those changes we are collecting the logs from this.
[43:52] Let's see in Kibana whether we have one index bracket by Apache name in stack management go to index argument on shape for Apache. Meanwhile we will check in this whether our okay this is our lock search and if it is a file bit is running data and sending to lock search it will
[44:21] see what it has read and that kind of stuff still we don't have any data over here and let's check in here gone also ok so what we will do we will add some data as it's harvester is running message
[44:50] non-zero matrix in last set is a little bit ok we have another instance first data I'll be we have we are collecting like logs from this territory so we go to that territory
[45:17] we will create one new log file over here vi data.log okay we will copy these two logs and paste and save okay
[45:46] we cannot let's do so-do-so okay writer.log paste this logs save this file okay save all right now there are two files let's save
[46:15] whether it is collecting some locks or not let's check over here it is still listing on 50 double port let's check in the tibana okay still we don't have any locks even this is oil bead running
[46:42] Let us see it is running as a wrote and this code result shows there is no permission issue. Let us see once again what is happening I have restarted the file bit.
[47:10] stays here lock size is increasing on same port 5 year old double port and it's sick
[47:34] Let me copy this and share with GPT. Let's see what it says. Okay. Okay.
[48:03] So, file bit is not able to read those logs if you are keeping. Okay, as you can see it is not able to relate any logs. So, let us see the input configuration. Okay.
[48:32] we have made this enable to paths path is also the look score and instead of this dot-clogs what is that look you can make this as a stop and save this and again execute this let's see
[48:54] whether this works so we have set this also where this file okay file strength is
[49:23] okay this is we have kept the port enabled is true and we have added the path location also there is no issue with this country still it is not able to reduce logs the path looks the same
[49:51] Let's check whether we are in the log Still there is no data flow as you can see 0 0 count is 0 Let's add it to Yammer
[50:20] id is good while staying locked path is the same
[50:48] Again I added one lock path and I am running.
[51:06] Ok, in lockstores conflict, we have set this STD out, it means that whenever we receive any kind of incoming data, it will print in this terminal also.
[51:34] So that's how we can test also So point bit has been started Let's wait for some time Still it is not taking any data
[51:59] with property here we can
[52:17] provide this config file also.
[52:44] mistakenly we operate with this workstars config in this. Let us provide this pump to file.
[53:13] Let's see what it says.
[53:40] has no locks so it says that it don't have any locks
[54:02] I did provide a detailed quote.
[54:24] Okay, so currently my file bit is running over here. So let me create new files.
[54:51] copy these two logs, generate new.log, paste these two logs and let's save and see whether it has received the logs are not saved.
[55:17] there is no data add few lines in this dot
[55:37] I will add some blocks to this. Let's see whether
[56:06] this works okay now make shape okay it has read something see this 26 that kind of stuff okay and let's see
[56:34] Go over here, here we are not getting anything. Now it is saying that four clients are listed. Let's see in Kibana UI whether you have a resident. Okay. As you can see, you have received data over here. Okay. So this is the data view. Indexes.
[57:03] Apache locks. Okay, all the X's are there. So we have to do data. So let's create a data for this. In same we have this in Kibana section. We have this data. I am naming this data as a Apache lock. Okay, so
[57:33] you provide a name for this data you set a indexing pattern so which will list all the indices matching those patterns so I will set like this okay only two indexes are there at the timestamp just save that and if you want to see the data in this data just click on menu go to display tab and click on
[57:59] click over here and check for appx logs so here you will find all the logs which you have provided okay so let me open one log and check is it the same okay as you can see this is a log entry from this demo.cat column
[58:26] let me show the file okay as you can see this is the login trip which we are talking about which is available in Kibana so okay
[58:50] let's check in JsonView input type is PerlStream that we have configured in our filebit.yaml okay this is the log file path data sample logs
[59:20] after that ok in tags we can see we have this grog pillar and this goi pillar why we are getting this grog pillar let me see go to grog debugger ok let's go to this grog debugger we will paste our
[59:48] block pattern from here over here and take sample log from here to here. So, these sample logs are parsing properly. Let us take for these logs. Let us paste those logs over here.
[60:17] as you can see it will have this agfailure grogparsfailure for this because it doesn't have this ip field ip field is not integer and it is able to parse this log so let's check for this path okay so we will check whether we have data from that new.log file
[60:47] so this is the file path so we will apply one filter okay is equal to mu okay so we have some logs from that path so what I did I just there is one log file path where
[61:14] it says that from which path location we are we are getting the locks so I have set that to this new lock so when we have in new locks look at new.locks we can see it has all the IP addresses provided so let's see whether those are passed properly or not okay let me take this document and just expand this
[61:44] Okay, so I think we have explicitly mentioned this in our path.
[62:12] it doesn't have so why it is pauses let me show you so we are in the same server where we have file width 3d file let me cat this let's check whether that's the issue
[62:38] It should have all the files, but currently it has taken only one file. Let us repress this. Why it is so? Let me explain. Right now we are here. We will check what locks we have purchased.
[63:08] so let me explain ok we have timestamp of 2006 ok and if my locks are coming in input plugin then it will go to this block it will match the message speed and IP and that kind of and we have used this data so it will store
[63:37] in that 2000 C and it is targeted to this at the right time stamp what it month means so all the which are GROC is not masked those will be shown over here and if I said that this years and about 20 years ago 22 years ago lets apply I will see
[64:07] the locks industry in 2006 that's why we will use this date field okay because the locks which we have it has this 2006 date okay that's why it's this all all locks should be passed in the same time duration when those locks were generated as you can see this is our time frame where we are seeing this locks industry in 2006 records okay and I have
[64:37] on this logs okay okay so let me open one log from this duration and let's check whether those are past or not okay
[65:01] so as you can see this is the field section where you can see what are the fields available so as you can we have defined some fields in this okay like client IP then timestamp will be removed then this is the method field then this is the request stdp version status quite socket so if you see if grok is correctly applied you should be able to see those fields okay this is the tag field then this is the status code
[65:31] okay 200 status code is there can we verify that okay as you can see for all this we have 200 status code okay again for request we have this request field also this method field is also there then then this is the log path okay then then then then we have this stgp version field also which we have it means that our data is correctly passed
[65:59] ok client IP ok this byte field is in bytes only as you can see this is integer ok and we we have past those date filter is also working correctly the status is also in integer format hash means integer this team in text and k means keyword whereas and if you see this calendar it means that the date section so our
[66:28] mapping is also correct only this mapping is incorrect which is for IP it should be IP not the text ok so that also we can correct ok ok so our data is passed and if I expand this I can see data in key value square
[66:56] okay here okay these are the pills which we we have set in method we will get this gate okay let's verify over here method gate okay stdp version we are getting one okay let's verify over here in stdp stdp version
[67:25] Okay, we are getting one apart from that status code 200 and bytes status code 200 and bytes will be in first page will be See This is how we have used this file bit. We have pasted blocks in using this blockstache pipeline
[67:52] So we will have some more examples related to this in next tutorial.
[67:58] you
